import { ref, shallowRef } from 'vue'
import { Client, type IMessage } from '@stomp/stompjs'
import type { ChatMessage } from '@/types/api'
import { chatService, toChatMessage } from '@/services/chat'

type ChatStatus = 'idle' | 'connecting' | 'connected' | 'error'

interface RawChatMessage {
  id: number
  roomId: number
  userId: number
  content: string
  verifiedAtGym: boolean
  createdAt: string
}

/** Derive the STOMP broker URL from the REST base URL. */
function brokerUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'
  // strip trailing /api → origin, then swap http(s)→ws(s) and append /ws
  const origin = base.replace(/\/api\/?$/, '')
  return origin.replace(/^http/, 'ws') + '/ws'
}

/**
 * STOMP-based live chat for a gym room.
 * - subscribe: /topic/gyms/{gymId}/chat
 * - publish:   /app/gyms/{gymId}/chat
 * - errors:    /user/queue/errors
 */
export function useGymChat(gymId: string) {
  const messages = ref<ChatMessage[]>([])
  const status = ref<ChatStatus>('idle')
  const client = shallowRef<Client | null>(null)

  function appendRaw(raw: RawChatMessage) {
    // Resolve the author asynchronously, then append in order.
    chatService.resolveMessageUser(raw.userId).then((user) => {
      messages.value.push(toChatMessage(raw, user))
    })
  }

  function connect(token: string) {
    if (client.value?.active) return
    status.value = 'connecting'

    const c = new Client({
      brokerURL: `${brokerUrl()}?token=${encodeURIComponent(token)}`,
      reconnectDelay: 4000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        status.value = 'connected'
        c.subscribe(`/topic/gyms/${gymId}/chat`, (msg: IMessage) => {
          try {
            const body = JSON.parse(msg.body)
            // STOMP @SendTo broadcasts ChatMessageResponse directly (not ApiResponse-wrapped)
            const raw: RawChatMessage = body?.data ?? body
            if (raw && raw.id != null) appendRaw(raw)
          } catch {
            /* ignore malformed frame */
          }
        })
        c.subscribe('/user/queue/errors', () => {
          status.value = 'error'
        })
      },
      onStompError: () => { status.value = 'error' },
      onWebSocketError: () => { status.value = 'error' },
      onWebSocketClose: () => {
        if (status.value !== 'error') status.value = 'idle'
      },
    })

    c.activate()
    client.value = c
  }

  function sendMessage(content: string, coords?: { lat: number; lng: number }) {
    const trimmed = content.trim()
    if (!trimmed || !client.value?.connected) return
    client.value.publish({
      destination: `/app/gyms/${gymId}/chat`,
      body: JSON.stringify({ content: trimmed, lat: coords?.lat ?? null, lng: coords?.lng ?? null }),
    })
  }

  function disconnect() {
    client.value?.deactivate()
    client.value = null
    status.value = 'idle'
  }

  return { messages, status, connect, sendMessage, disconnect }
}
