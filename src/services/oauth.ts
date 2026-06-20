// 소셜 로그인 provider 설정 + authorize URL 조립 + 시스템 브라우저 열기.
// 백엔드 교환/가입 호출은 services/auth.ts(authService), 앱 플로우(스토어·라우팅)는
// composables/useOAuth.ts 가 담당한다. 이 파일은 "provider 메타데이터 + URL + 브라우저"만.
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { OAuthProvider } from "@/types/api";
import { generateCodeChallenge, generateCodeVerifier, randomState } from "@/utils/pkce";

interface ProviderConfig {
  authorizeUrl: string;
  clientId: string;
  /** 빈 문자열이면 scope 파라미터를 생략한다(콘솔 기본 동의항목 사용). */
  scope: string;
  /** 네이버는 PKCE 미지원 → false. */
  usesPkce: boolean;
}

// client_id 는 공개값이라 프론트 env 로 주입한다. client_secret 은 백엔드 전용(절대 금지).
const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  [OAuthProvider.GOOGLE]: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
    scope: "openid email profile",
    usesPkce: true,
  },
  [OAuthProvider.KAKAO]: {
    authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
    clientId: import.meta.env.VITE_KAKAO_CLIENT_ID ?? "",
    scope: "",
    usesPkce: true,
  },
  [OAuthProvider.NAVER]: {
    authorizeUrl: "https://nid.naver.com/oauth2.0/authorize",
    clientId: import.meta.env.VITE_NAVER_CLIENT_ID ?? "",
    scope: "",
    usesPkce: false,
  },
};

// URL 경로/콜백 라우트에서 쓰는 소문자 슬러그 ↔ provider enum 매핑.
const PROVIDER_SLUG: Record<OAuthProvider, string> = {
  [OAuthProvider.GOOGLE]: "google",
  [OAuthProvider.KAKAO]: "kakao",
  [OAuthProvider.NAVER]: "naver",
};

// 네이티브 커스텀 스킴. capacitor appId 와 동일 + iOS Info.plist 에 등록 필요.
const NATIVE_SCHEME = "com.hola.climbing";

const STORAGE = {
  state: "oauth_state",
  verifier: "oauth_verifier",
} as const;

/** 콜백 처리 중 발생하는 클라이언트/제공자 단 오류. code 로 UI 분기 가능. */
export class OAuthError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "OAuthError";
  }
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function providerSlug(provider: OAuthProvider): string {
  return PROVIDER_SLUG[provider];
}

export function providerFromSlug(slug: string): OAuthProvider | null {
  const entry = (Object.entries(PROVIDER_SLUG) as Array<[OAuthProvider, string]>).find(([, s]) => s === slug);
  return entry ? entry[0] : null;
}

const WEB_OAUTH_CALLBACK_ORIGIN = "https://hola-climb.app";

/** authorize 와 exchange 양쪽에서 반드시 동일해야 하는 redirect_uri. 플랫폼별 분기. */
export function redirectUri(provider: OAuthProvider): string {
  const slug = PROVIDER_SLUG[provider];
  if (isNative()) return `${NATIVE_SCHEME}://oauth/${slug}`;
  return `${WEB_OAUTH_CALLBACK_ORIGIN}/auth/oauth/${slug}/callback`;
}

/** authorize URL 조립 + state/verifier 저장 후 시스템 브라우저로 이동. */
export async function startLogin(provider: OAuthProvider): Promise<void> {
  const cfg = PROVIDERS[provider];
  if (!cfg.clientId) {
    throw new OAuthError("missing_client_id", "소셜 로그인 설정이 아직 준비되지 않았어요.");
  }

  const state = randomState();
  sessionStorage.setItem(STORAGE.state, state);

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(provider),
    response_type: "code",
    state,
  });
  if (cfg.scope) params.set("scope", cfg.scope);

  if (cfg.usesPkce) {
    const verifier = generateCodeVerifier();
    sessionStorage.setItem(STORAGE.verifier, verifier);
    params.set("code_challenge", await generateCodeChallenge(verifier));
    params.set("code_challenge_method", "S256");
  } else {
    sessionStorage.removeItem(STORAGE.verifier);
  }

  const url = `${cfg.authorizeUrl}?${params.toString()}`;
  if (isNative()) {
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
}

interface CallbackQuery {
  code?: string | null;
  state?: string | null;
  error?: string | null;
  errorDescription?: string | null;
}

/** 콜백 쿼리 검증(state, error) + verifier 회수. 성공 시 exchange 에 넘길 값 반환.
 *  한 번 쓰면 저장한 state/verifier 는 폐기한다(재사용 방지). */
export function resolveCallback(provider: OAuthProvider, q: CallbackQuery): { code: string; codeVerifier: string | null } {
  if (q.error) {
    throw new OAuthError(q.error, q.errorDescription ?? "소셜 로그인이 취소되었어요.");
  }
  if (!q.code) {
    throw new OAuthError("no_code", "인가코드를 받지 못했어요.");
  }

  const savedState = sessionStorage.getItem(STORAGE.state);
  if (!q.state || !savedState || q.state !== savedState) {
    throw new OAuthError("state_mismatch", "보안 검증에 실패했어요. 다시 시도해주세요.");
  }

  const verifier = sessionStorage.getItem(STORAGE.verifier);
  sessionStorage.removeItem(STORAGE.state);
  sessionStorage.removeItem(STORAGE.verifier);

  return { code: q.code, codeVerifier: PROVIDERS[provider].usesPkce ? verifier : null };
}

/** 네이티브에서 띄운 시스템 브라우저 닫기(콜백 수신 후). 웹에선 no-op. */
export async function closeBrowser(): Promise<void> {
  if (isNative()) {
    try {
      await Browser.close();
    } catch {
      /* 이미 닫혔으면 무시 */
    }
  }
}
