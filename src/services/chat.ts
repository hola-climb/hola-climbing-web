import api from './client'
import type { ChatMessage, ChatRoom, PageResponse, VideoUser } from '@/types/api'
import { resolveUser, resolveUsers } from './userResolver'

interface RawChatMessage {
  id: number
  roomId: number
  userId: number
  content: string
  verifiedAtGym: boolean
  createdAt: string
}

export function toChatMessage(raw: RawChatMessage, user: VideoUser): ChatMessage {
  return {
    id: String(raw.id),
    roomId: String(raw.roomId),
    user,
    content: raw.content,
    verifiedAtGym: raw.verifiedAtGym,
    createdAt: raw.createdAt,
  }
}

export const chatService = {
  /** 최근 메시지 (미리보기/이력) — GET /api/chats/gyms/{gymId}/messages */
  getMessages: async (gymId: string, params?: { page?: number; size?: number }): Promise<{ data: PageResponse<ChatMessage> }> => {
    const { data } = await api.get<PageResponse<RawChatMessage>>(`/chats/gyms/${gymId}/messages`, { params })
    const userMap = await resolveUsers(data.content.map((m) => m.userId))
    return {
      data: {
        ...data,
        content: data.content.map((m) =>
          toChatMessage(m, userMap.get(String(m.userId)) ?? { id: String(m.userId), nickname: '사용자', profileImage: null }),
        ),
      },
    }
  },

  /** 채팅방 입장(멤버 등록) — POST /api/chats/gyms/{gymId}/join */
  joinRoom: (gymId: string) =>
    api.post<{ id: number; gymId: number; name: string }>(`/chats/gyms/${gymId}/join`)
      .then((res) => ({
        ...res,
        data: { id: String(res.data.id), gymId: String(res.data.gymId), name: res.data.name } as ChatRoom,
      })),

  /** 단일 메시지의 작성자 해석 (WebSocket 수신 시) */
  resolveMessageUser: (userId: number | string): Promise<VideoUser> => resolveUser(String(userId)),
}
