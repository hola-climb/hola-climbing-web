import { defineStore } from 'pinia'
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
  const base = import.meta.env.VITE_API_BASE_URL ?? 'https://www.hola-climb.app/api'
  // strip trailing /api → origin, then swap http(s)→ws(s) and append /ws
  const origin = base.replace(/\/api\/?$/, '')
  return origin.replace(/^http/, 'ws') + '/ws'
}

/**
 * Gym live-chat state, lifted out of the GymDetailView component so the open
 * chat (modal visibility, message history, and the live STOMP socket) survives
 * the component being unmounted/remounted — e.g. when the explore two-pane
 * collapses to the mobile route on a window resize.
 *
 * Lifetime is governed by a viewer ref-count rather than `onUnmounted`:
 * a brief overlap of two views of the *same* gym (during a route transition)
 * keeps the socket alive, while genuinely leaving the gym tears it down.
 */
export const useChatStore = defineStore('chat', () => {
  // state ────────────────────────────────────────────
  const activeGymId = ref<string | null>(null)
  const showChat = ref(false)
  const isJoining = ref(false)
  const messages = ref<ChatMessage[]>([])
  const status = ref<ChatStatus>('idle')
  const draft = ref('')
  const client = shallowRef<Client | null>(null)

  // Non-reactive bookkeeping for deferred teardown.
  const viewers = new Map<string, number>()
  let teardownTimer: ReturnType<typeof setTimeout> | null = null

  // socket ────────────────────────────────────────────
  function appendRaw(raw: RawChatMessage) {
    // Resolve the author asynchronously, then append in order.
    chatService.resolveMessageUser(raw.userId).then((user) => {
      messages.value.push(toChatMessage(raw, user))
    })
  }

  function connect(gymId: string, token: string) {
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

  function disconnect() {
    client.value?.deactivate()
    client.value = null
    status.value = 'idle'
  }

  // high-level room actions ───────────────────────────
  /**
   * Join + load history + open the chat for `gymId`, then connect the socket.
   * Throws if joining the room fails (the only hard requirement); history and
   * the live connection are best-effort. Switching rooms tears down the old one.
   */
  async function enterRoom(gymId: string, token: string) {
    if (activeGymId.value && activeGymId.value !== gymId) {
      disconnect()
      draft.value = ''
    }
    isJoining.value = true
    try {
      await chatService.joinRoom(gymId)
      activeGymId.value = gymId

      try {
        const { data } = await chatService.getMessages(gymId, { page: 0, size: 30 })
        messages.value = [...data.content].reverse()
      } catch (e) {
        if (import.meta.env.DEV) console.error('[chat] history load failed', e)
        messages.value = []
      }

      showChat.value = true
      try {
        connect(gymId, token)
      } catch (e) {
        if (import.meta.env.DEV) console.error('[chat] ws connect failed', e)
      }
    } finally {
      isJoining.value = false
    }
  }

  /** Explicitly close the chat and drop the socket. */
  function leaveRoom() {
    showChat.value = false
    activeGymId.value = null
    draft.value = ''
    disconnect()
  }

  function sendMessage(content: string, coords?: { lat: number; lng: number }) {
    const trimmed = content.trim()
    if (!trimmed || !client.value?.connected) return
    client.value.publish({
      destination: `/app/gyms/${activeGymId.value}/chat`,
      body: JSON.stringify({ content: trimmed, lat: coords?.lat ?? null, lng: coords?.lng ?? null }),
    })
  }

  // viewer ref-count (survive remount, tear down on real leave) ──
  function retainView(gymId: string) {
    viewers.set(gymId, (viewers.get(gymId) ?? 0) + 1)
  }

  function releaseView(gymId: string) {
    viewers.set(gymId, Math.max(0, (viewers.get(gymId) ?? 0) - 1))
    // Defer the teardown decision: if another view of the same gym mounts
    // within this window (a route transition handoff), the socket is kept.
    if (teardownTimer) clearTimeout(teardownTimer)
    teardownTimer = setTimeout(() => {
      teardownTimer = null
      const active = activeGymId.value
      if (active && (viewers.get(active) ?? 0) <= 0) leaveRoom()
    }, 150)
  }

  return {
    activeGymId, showChat, isJoining, messages, status, draft,
    enterRoom, leaveRoom, sendMessage,
    retainView, releaseView,
  }
})
