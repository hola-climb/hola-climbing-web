// 소셜 로그인 앱 플로우 오케스트레이션 (백엔드 redirect 흐름).
// - startLogin: 버튼 → 백엔드 /authorize 로 페이지 이동 (services/oauth 위임)
// - handleCallback: 프론트 /oauth/callback 에서 oauthCode 받아 /result 호출 →
//   status 분기 (LOGGED_IN / SIGNUP_REQUIRED / EMAIL_ALREADY_EXISTS)
import { useRouter } from "vue-router";
import { OAuthProvider } from "@/types/api";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import * as oauth from "@/services/oauth";

const SOCIAL_SIGNUP_KEY = "oauth_signup_ctx";

export interface SocialSignupContext {
  signupToken: string;
  email: string | null;
  suggestedNickname: string | null;
  profileImage: string | null;
}

/** 소셜 가입 화면에서 프리필/토큰을 읽어온다. 없으면 null(직접 접근). */
export function loadSocialSignupContext(): SocialSignupContext | null {
  const raw = sessionStorage.getItem(SOCIAL_SIGNUP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SocialSignupContext;
  } catch {
    return null;
  }
}

export function clearSocialSignupContext(): void {
  sessionStorage.removeItem(SOCIAL_SIGNUP_KEY);
}

export interface CallbackQuery {
  oauthCode?: string | null;
  oauthError?: string | null;
}

export function useOAuth() {
  const router = useRouter();
  const authStore = useAuthStore();
  const uiStore = useUIStore();

  async function startLogin(provider: OAuthProvider): Promise<void> {
    try {
      await oauth.startLogin(provider);
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error(err);
      uiStore.showToast("소셜 로그인을 시작하지 못했어요.", "danger");
    }
  }

  // oauthCode 는 1회용(TTL 1분). 콜백 마운트 시 즉시 한 번만 호출해야 한다.
  async function handleCallback(query: CallbackQuery, redirect = "/feed"): Promise<void> {
    await oauth.closeBrowser();

    if (query.oauthError) {
      uiStore.showToast("소셜 로그인이 취소되었어요.", "danger");
      router.replace("/auth/login");
      return;
    }
    if (!query.oauthCode) {
      uiStore.showToast("로그인 정보를 받지 못했어요. 다시 시도해주세요.", "danger");
      router.replace("/auth/login");
      return;
    }

    try {
      const result = await authStore.oauthResult({ code: query.oauthCode });

      if (result.status === "SIGNUP_REQUIRED") {
        const ctx: SocialSignupContext = {
          signupToken: result.signupToken ?? "",
          email: result.email ?? null,
          suggestedNickname: result.suggestedNickname ?? null,
          profileImage: result.profileImage ?? null,
        };
        sessionStorage.setItem(SOCIAL_SIGNUP_KEY, JSON.stringify(ctx));
        router.replace("/auth/social-signup");
        return;
      }

      if (result.status === "EMAIL_ALREADY_EXISTS") {
        uiStore.showToast("이미 이메일로 가입된 계정이에요. 이메일 로그인을 이용해주세요.", "warning");
        router.replace("/auth/login");
        return;
      }

      // LOGGED_IN — 스토어에서 토큰 적용 + 프로필 로드까지 끝난 상태
      router.replace(redirect);
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error(err);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      uiStore.showToast(msg ?? "소셜 로그인에 실패했어요.", "danger");
      router.replace("/auth/login");
    }
  }

  return { startLogin, handleCallback };
}
