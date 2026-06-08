import api from './client'
import type { Notification, NotificationType, PageResponse, VideoUser } from '@/types/api'
import { resolveUsers } from './userResolver'

/** Raw GET /api/notifications item — backend NotificationResponse (flat, senderId/content) */
interface RawNotification {
  id: number
  type: NotificationType
  targetType: 'video' | 'user' | 'gym' | null
  targetId: number | null
  senderId: number | null
  title: string
  content: string
  isRead: boolean
  createdAt: string
}

function toNotification(raw: RawNotification, actor: VideoUser | null): Notification {
  return {
    id: String(raw.id),
    type: raw.type,
    title: raw.title,
    message: raw.content,
    targetType: raw.targetType,
    targetId: raw.targetId != null ? String(raw.targetId) : null,
    actor,
    isRead: raw.isRead,
    createdAt: raw.createdAt,
  }
}

export const notificationService = {
  /** 알림 목록 조회 — GET /api/notifications?page=&size=&unreadOnly= */
  getNotifications: async (params?: { page?: number; size?: number; unreadOnly?: boolean }): Promise<{ data: PageResponse<Notification> }> => {
    const { data } = await api.get<PageResponse<RawNotification>>('/notifications', { params })
    const senderIds = data.content.map((n) => n.senderId).filter((id): id is number => id != null)
    const userMap = await resolveUsers(senderIds)
    return {
      data: {
        ...data,
        content: data.content.map((n) =>
          toNotification(n, n.senderId != null ? userMap.get(String(n.senderId)) ?? null : null),
        ),
      },
    }
  },

  /** 미확인 알림 개수 — GET /api/notifications/unread-count */
  getUnreadCount: () =>
    api.get<{ unreadCount?: number; unread_count?: number }>('/notifications/unread-count')
      .then((res) => ({ ...res, data: res.data.unreadCount ?? res.data.unread_count ?? 0 })) as Promise<{ data: number }>,

  /** 알림 읽음 처리 — PATCH /api/notifications/{id}/read  (id='all' → 전체) */
  markRead: (id: string | 'all') =>
    api.patch<{ unreadCount: number }>(`/notifications/${id}/read`),

  /** 알림 삭제 — DELETE /api/notifications/{id} */
  deleteNotification: (id: string) =>
    api.delete(`/notifications/${id}`),

  /** 알림 설정 변경 — PATCH /api/notifications/settings */
  updateSettings: (settings: Partial<{
    notifyComment: boolean
    notifyReply: boolean
    notifyLike: boolean
    notifyFollow: boolean
    notifyChat: boolean
    notifySystem: boolean
  }>) => api.patch('/notifications/settings', settings),

  // ── Device tokens (FCM push) ──────────────────────────────────────────────

  /** 디바이스 토큰 등록 — POST /api/users/me/device-tokens */
  registerDeviceToken: (token: string, platform: 'android' | 'ios' | 'web') =>
    api.post('/users/me/device-tokens', { token, platform }),

  /** 디바이스 토큰 해제 — DELETE /api/users/me/device-tokens */
  removeDeviceToken: (token: string) =>
    api.delete('/users/me/device-tokens', { data: { token } }),
}
