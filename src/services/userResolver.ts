import api from './client'
import type { VideoUser } from '@/types/api'

// Shared author-profile cache so lists (comments/reviews/chat) don't refetch the same user.
const userCache = new Map<string, VideoUser>()

/** Resolve a userId → minimal public profile. Never throws (falls back to '사용자'). */
export async function resolveUser(userId: string): Promise<VideoUser> {
  if (userCache.has(userId)) return userCache.get(userId)!
  try {
    const { data } = await api.get<{
      userId?: number
      id?: number
      nickname: string
      profileImage?: string | null
      profileImageUrl?: string | null
    }>(`/users/${userId}`)
    const user: VideoUser = {
      id: String(data.id ?? data.userId ?? userId),
      nickname: data.nickname ?? '사용자',
      profileImageUrl: data.profileImageUrl ?? data.profileImage ?? null,
    }
    userCache.set(userId, user)
    return user
  } catch {
    return { id: userId, nickname: '사용자', profileImageUrl: null }
  }
}

/** Resolve many userIds at once (deduped). Returns a Map keyed by string id. */
export async function resolveUsers(userIds: Array<string | number>): Promise<Map<string, VideoUser>> {
  const unique = [...new Set(userIds.map(String))]
  const users = await Promise.all(unique.map((id) => resolveUser(id)))
  return new Map(users.map((u, i) => [unique[i], u]))
}
