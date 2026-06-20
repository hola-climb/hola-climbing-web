// 소셜 로그인 앱 플로우 오케스트레이션.
// - startLogin: 버튼 → 시스템 브라우저로 이동 (services/oauth 위임)
// - handleCallback: 웹 콜백 페이지 / 네이티브 딥링크 공통 처리
//   (state 검증 → exchange → 기존이면 로그인, 신규면 가입 화면으로 분기)
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
  code?: string | null;
  state?: string | null;
  error?: string | null;
  errorDescription?: string | null;
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
      const msg = err instanceof oauth.OAuthError ? err.message : "소셜 로그인을 시작하지 못했어요.";
      uiStore.showToast(msg, "danger");
    }
  }

  async function handleCallback(provider: OAuthProvider, query: CallbackQuery, redirect = "/feed"): Promise<void> {
    try {
      const { code, codeVerifier } = oauth.resolveCallback(provider, query);
      const result = await authStore.oauthExchange({
        provider,
        code,
        redirectUri: oauth.redirectUri(provider),
        codeVerifier,
      });
      await oauth.closeBrowser();

      if (result.signupRequired) {
        const ctx: SocialSignupContext = {
          signupToken: result.signupToken ?? "",
          email: result.email,
          suggestedNickname: result.suggestedNickname,
          profileImage: result.profileImage,
        };
        sessionStorage.setItem(SOCIAL_SIGNUP_KEY, JSON.stringify(ctx));
        router.replace("/auth/social-signup");
        return;
      }

      router.replace(redirect);
    } catch (err: unknown) {
      await oauth.closeBrowser();
      if (import.meta.env.DEV) console.error(err);
      _toastError(err);
      router.replace("/auth/login");
    }
  }

  function _toastError(err: unknown): void {
    // 백엔드 exchange 에러(이메일 충돌 등). 에러코드 문자열은 백엔드와 확정 필요.
    const res = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
    if (res?.code === "AUTH_EMAIL_EXISTS") {
      uiStore.showToast("이미 이메일로 가입된 계정이에요. 이메일 로그인을 이용해주세요.", "warning");
      return;
    }
    if (err instanceof oauth.OAuthError) {
      uiStore.showToast(err.message, "danger");
      return;
    }
    uiStore.showToast(res?.message ?? "소셜 로그인에 실패했어요.", "danger");
  }

  return { startLogin, handleCallback };
}
