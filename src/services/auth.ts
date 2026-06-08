import api from './client'
import type {
  AuthTokens, BlockedUser, FollowUser, LoginPayload,
  PageResponse, RegisterPayload, Term, User, UserPublicProfile,
} from '@/types/api'

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
}

export const authService = {
  // ── Auth ──────────────────────────────────────────────────────────────────

  login: (payload: LoginPayload) =>
    api.post<LoginResponse>('/auth/login', payload),

  register: (payload: RegisterPayload) =>
    api.post<{ userId: number; email: string; nickname: string; emailVerified: boolean }>('/auth/signup', payload),

  /** 활성 약관 목록 — GET /api/terms (공개) */
  getTerms: () =>
    api.get<Term[]>('/terms'),

  // Social login — not in spec yet, kept for future
  socialLogin: (provider: 'google' | 'kakao' | 'naver', code: string, redirectUri: string) =>
    api.post<LoginResponse>(`/auth/social/${provider}`, { code, redirectUri }),

  refresh: (refreshToken: string) =>
    api.post<AuthTokens>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  checkNickname: (nickname: string) =>
    api.get<{ available: boolean }>('/auth/nickname-check', { params: { nickname } }),

  // ── My profile ────────────────────────────────────────────────────────────

  getMe: () =>
    api.get<User>('/users/me'),

  updateProfile: (payload: Partial<Pick<User, 'nickname' | 'profileImageUrl' | 'bio'>>) =>
    api.patch<User>('/users/me', payload),

  deleteAccount: (password: string, reason?: string) =>
    api.delete('/users/me', { data: { password, reason } }),

  sendPasswordReset: (email: string) =>
    api.post('/auth/password/reset-request', { email }),

  confirmPasswordReset: (token: string, newPassword: string) =>
    api.post('/auth/password/reset', { token, newPassword }),

  verifyEmail: (token: string) =>
    api.post('/auth/email/verify', { token }),

  // ── User profile ─────────────────────────────────────────────────────────

  getUserProfile: (userId: string) =>
    api.get<UserPublicProfile>(`/users/${userId}`),

  // ── Follow ────────────────────────────────────────────────────────────────

  follow: (userId: string) =>
    api.post<{ isFollowing: boolean; followerCount: number }>(`/users/${userId}/follow`),

  unfollow: (userId: string) =>
    api.delete<{ isFollowing: boolean; followerCount: number }>(`/users/${userId}/follow`),

  getFollowers: (userId: string, params?: { page?: number; size?: number }) =>
    api.get<PageResponse<FollowUser>>(`/users/${userId}/followers`, { params }),

  getFollowing: (userId: string, params?: { page?: number; size?: number }) =>
    api.get<PageResponse<FollowUser>>(`/users/${userId}/following`, { params }),

  // ── Block ─────────────────────────────────────────────────────────────────

  blockUser: (userId: string) =>
    api.post(`/users/${userId}/block`),

  unblockUser: (userId: string) =>
    api.delete(`/users/${userId}/block`),

  getBlockList: (params?: { page?: number; size?: number }) =>
    api.get<PageResponse<BlockedUser>>('/users/me/blocks', { params }),
}
