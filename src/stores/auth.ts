import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { OAuthExchangeRequest, OAuthLoginResponse, OAuthSignupRequest, User } from "@/types/api";
import { authService } from "@/services/auth";
import { setObservabilityUser } from "@/services/observability";

export const useAuthStore = defineStore("auth", () => {
  // state
  const user = ref<User | null>(null);
  const isLoading = ref(false);
  // Memoized session-restore promise so the router guard can await it once.
  let initPromise: Promise<void> | null = null;

  // computed
  const isAuthenticated = computed(() => !!user.value);

  // 관측 유저 컨텍스트 동기화 — 로그인/로그아웃/세션복원 모두 한 곳에서 처리.
  // id만 전달(이메일·닉네임 등 PII 금지).
  watch(
    () => user.value?.id,
    (id) => setObservabilityUser(id || undefined),
  );

  // actions
  async function login(email: string, password: string) {
    isLoading.value = true;
    try {
      // Login response only carries tokens; profile comes from /users/me
      const { data } = await authService.login({ email, password });
      _applyTokens(data.accessToken, data.refreshToken);
      await fetchMe();
    } finally {
      isLoading.value = false;
    }
  }

  async function register(email: string, password: string, nickname: string, termsAgreed: Array<{ termId: number; agreed: boolean }>) {
    isLoading.value = true;
    try {
      // Signup sends a verification email; user must verify before logging in.
      // (No auto-login — backend rejects login until email is verified.)
      await authService.register({ email, password, nickname, termsAgreed });
    } finally {
      isLoading.value = false;
    }
  }

  /** 약관 재동의 기록 (NF-10) — 약관 갱신 시 로그인 사용자가 다시 동의할 때 사용 */
  async function agreeTerms(agreements: Array<{ termId: number; agreed: boolean }>) {
    await authService.agreeTerms(agreements);
  }

  /** 소셜 로그인 1단계 — 인가코드 교환. 기존 유저면 토큰 적용 후 프로필까지 로드.
   *  신규 유저면 토큰 없이 OAuthLoginResponse 를 그대로 반환 → 호출부가 가입 화면으로. */
  async function oauthExchange(payload: OAuthExchangeRequest): Promise<OAuthLoginResponse> {
    isLoading.value = true;
    try {
      const { data } = await authService.oauthExchange(payload);
      if (!data.signupRequired && data.token) {
        _applyTokens(data.token.accessToken, data.token.refreshToken);
        await fetchMe();
      }
      return data;
    } finally {
      isLoading.value = false;
    }
  }

  /** 소셜 로그인 2단계 — 신규 유저 가입 완료. 응답 토큰으로 즉시 로그인 상태가 된다. */
  async function oauthSignup(payload: OAuthSignupRequest) {
    isLoading.value = true;
    try {
      const { data } = await authService.oauthSignup(payload);
      _applyTokens(data.accessToken, data.refreshToken);
      await fetchMe();
    } finally {
      isLoading.value = false;
    }
  }

  async function logout() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {
        /* best-effort */
      }
    }
    _clearTokens();
    user.value = null;
    initPromise = null; // allow re-init on next login
  }

  // Backend MyProfileResponse uses userId/profileImage; map to client User.
  // Shared by fetchMe / updateProfile / profile-image actions so every write
  // goes through the same shape (otherwise id·profileImageUrl get dropped).
  function _mapMyProfile(data: unknown): User {
    const raw = data as {
      userId?: string | number;
      id?: string;
      email: string;
      nickname: string;
      profileImage?: string | null;
      profileImageUrl?: string | null;
      bio?: string | null;
      emailVerified?: boolean;
      followerCount?: number;
      followingCount?: number;
      videoCount?: number;
      createdAt: string;
      role?: "USER" | "ADMIN";
    };
    return {
      id: String(raw.id ?? raw.userId ?? ""),
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
    };
  }

  async function fetchMe() {
    try {
      const { data } = await authService.getMe();
      user.value = _mapMyProfile(data);
    } catch {
      // Only clear auth state if there's no existing user (standalone refresh)
      if (!user.value) {
        _clearTokens();
      }
    }
  }

  /** 닉네임/소개 수정. bio: "" 는 소개 비우기, undefined 는 변경 안 함. */
  async function updateProfile(payload: { nickname?: string; bio?: string }) {
    const { data } = await authService.updateProfile(payload);
    user.value = _mapMyProfile(data);
  }

  /** 프로필 이미지 업로드/교체 (multipart). */
  async function uploadProfileImage(image: File) {
    const { data } = await authService.uploadProfileImage(image);
    user.value = _mapMyProfile(data);
  }

  /** 프로필 이미지 삭제 (백엔드 추가 예정). */
  async function removeProfileImage() {
    const { data } = await authService.deleteProfileImage();
    user.value = _mapMyProfile(data);
  }

  function saveClimbingInfo(climbingExperienceMonths: number) {
    if (user.value) user.value.climbingExperienceMonths = climbingExperienceMonths;
  }

  async function deleteAccount(password: string) {
    await authService.deleteAccount(password);
    _clearTokens();
    user.value = null;
  }

  /** Restore session from localStorage. Idempotent — returns the same promise
   *  so the router guard and app bootstrap can both await a single fetchMe. */
  function initFromStorage(): Promise<void> {
    if (!initPromise) {
      const token = localStorage.getItem("access_token");
      initPromise = token ? fetchMe() : Promise.resolve();
    }
    return initPromise;
  }

  function _applyTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
  }

  function _clearTokens() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    agreeTerms,
    oauthExchange,
    oauthSignup,
    logout,
    fetchMe,
    updateProfile,
    uploadProfileImage,
    removeProfileImage,
    saveClimbingInfo,
    deleteAccount,
    initFromStorage,
  };
});
