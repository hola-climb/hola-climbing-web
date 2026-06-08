import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types/api'
import { authService } from '@/services/auth'

export const useAuthStore = defineStore('auth', () => {
  // state
  const user = ref<User | null>(null)
  const isLoading = ref(false)
  // Memoized session-restore promise so the router guard can await it once.
  let initPromise: Promise<void> | null = null

  // computed
  const isAuthenticated = computed(() => !!user.value)

  // actions
  async function login(email: string, password: string) {
    isLoading.value = true
    try {
      // Login response only carries tokens; profile comes from /users/me
      const { data } = await authService.login({ email, password })
      _applyTokens(data.accessToken, data.refreshToken)
      await fetchMe()
    } finally {
      isLoading.value = false
    }
  }

  async function register(email: string, password: string, nickname: string, termsAgreed: Array<{ termId: number; agreed: boolean }>) {
    isLoading.value = true
    try {
      // Signup sends a verification email; user must verify before logging in.
      // (No auto-login — backend rejects login until email is verified.)
      await authService.register({ email, password, nickname, termsAgreed })
    } finally {
      isLoading.value = false
    }
  }

  async function socialLogin(provider: 'google' | 'kakao' | 'naver', code: string, redirectUri: string) {
    isLoading.value = true
    try {
      const { data } = await authService.socialLogin(provider, code, redirectUri)
      _applyTokens(data.accessToken, data.refreshToken)
      await fetchMe()
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      try { await authService.logout(refreshToken) } catch { /* best-effort */ }
    }
    _clearTokens()
    user.value = null
    initPromise = null   // allow re-init on next login
  }

  async function fetchMe() {
    try {
      const { data } = await authService.getMe()
      // Backend MyProfileResponse uses userId/profileImage; map to client User
      const raw = data as unknown as {
        userId?: string | number
        id?: string
        email: string
        nickname: string
        profileImage?: string | null
        profileImageUrl?: string | null
        bio?: string | null
        emailVerified?: boolean
        followerCount?: number
        followingCount?: number
        videoCount?: number
        createdAt: string
        role?: 'USER' | 'ADMIN'
      }
      user.value = {
        id: String(raw.id ?? raw.userId ?? ''),
        email: raw.email,
        nickname: raw.nickname,
        profileImageUrl: raw.profileImageUrl ?? raw.profileImage ?? null,
        bio: raw.bio ?? null,
        emailVerified: raw.emailVerified ?? false,
        followerCount: raw.followerCount ?? 0,
        followingCount: raw.followingCount ?? 0,
        videoCount: raw.videoCount ?? 0,
        createdAt: raw.createdAt,
        role: raw.role,
      }
    } catch {
      // Only clear auth state if there's no existing user (standalone refresh)
      if (!user.value) {
        _clearTokens()
      }
    }
  }

  async function updateProfile(payload: Partial<Pick<User, 'nickname' | 'profileImageUrl' | 'bio'>>) {
    const { data } = await authService.updateProfile(payload)
    user.value = data
  }

  function saveClimbingInfo(climbingExperienceMonths: number) {
    if (user.value) user.value.climbingExperienceMonths = climbingExperienceMonths
  }

  async function deleteAccount(password: string) {
    await authService.deleteAccount(password)
    _clearTokens()
    user.value = null
  }

  /** Restore session from localStorage. Idempotent — returns the same promise
   *  so the router guard and app bootstrap can both await a single fetchMe. */
  function initFromStorage(): Promise<void> {
    if (!initPromise) {
      const token = localStorage.getItem('access_token')
      initPromise = token ? fetchMe() : Promise.resolve()
    }
    return initPromise
  }

  function _applyTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
  }

  function _clearTokens() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    socialLogin,
    logout,
    fetchMe,
    updateProfile,
    saveClimbingInfo,
    deleteAccount,
    initFromStorage,
  }
})
