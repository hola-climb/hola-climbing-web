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

  /** 이메일 중복 확인 — GET /api/auth/email-check?email= (공개) */
  checkEmail: (email: string) =>
    api.get<{ available: boolean }>('/auth/email-check', { params: { email } }),

  /** 인증메일 재발송 — POST /api/auth/resend-verification (공개)
   *  보안상 미가입 이메일이어도 동일하게 200을 반환한다. */
  resendVerification: (email: string) =>
    api.post('/auth/resend-verification', { email }),

  /** 약관 동의 기록 — POST /api/terms/agree (인증 필요, NF-10)
   *  약관 갱신 시 로그인 사용자의 재동의를 기록한다. */
  agreeTerms: (agreements: Array<{ termId: number; agreed: boolean }>) =>
    api.post('/terms/agree', { agreements }),

  // ── My profile ────────────────────────────────────────────────────────────

  getMe: () =>
    api.get<User>('/users/me'),

  /** 내 정보 수정 — PATCH /api/users/me (닉네임/소개만)
   *  주의: profileImage 를 body 에 넣으면 400 C001. 이미지는 별도 multipart API.
   *  bio 를 빈 문자열("")로 보내면 소개가 지워진다. null 은 "변경 안 함" 시맨틱. */
  updateProfile: (payload: { nickname?: string; bio?: string }) =>
    api.patch<User>('/users/me', payload),

  /** 프로필 이미지 업로드/교체 — POST /api/users/me/profile-image (multipart)
   *  허용: jpg/jpeg/png, 최대 5MB. 응답은 갱신된 MyProfileResponse. */
  uploadProfileImage: (image: File) => {
    const form = new FormData()
    form.append('image', image)
    return api.post<User>('/users/me/profile-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** 프로필 이미지 삭제 — DELETE /api/users/me/profile-image
   *  (백엔드 추가 예정. 응답은 갱신된 MyProfileResponse 가정.) */
  deleteProfileImage: () =>
    api.delete<User>('/users/me/profile-image'),

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
