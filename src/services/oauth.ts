// 백엔드 OAuth redirect 흐름의 진입부.
// 프론트는 provider SDK/인가코드/PKCE 를 직접 다루지 않는다. 백엔드 /authorize 로
// 페이지 이동시키면 백엔드가 provider 로그인·콜백·토큰교환을 처리하고,
// 프론트 /oauth/callback 으로 1회용 oauthCode 를 들고 돌아온다.
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { OAuthProvider } from "@/types/api";

// authorize 엔드포인트 베이스. 웹은 동일출처 "/api", 네이티브는 절대 URL.
const API_BASE = Capacitor.isNativePlatform() ? import.meta.env.VITE_API_BASE_URL : "/api";

// URL 경로에 쓰는 소문자 슬러그.
const PROVIDER_SLUG: Record<OAuthProvider, string> = {
  [OAuthProvider.GOOGLE]: "google",
  [OAuthProvider.KAKAO]: "kakao",
  [OAuthProvider.NAVER]: "naver",
  [OAuthProvider.APPLE]: "apple",
};

// 네이티브 커스텀 스킴. 백엔드가 콜백을 이 주소로 리다이렉트하면 OS 가 앱을 깨운다.
// (iOS Info.plist 에 등록됨. 백엔드 redirectUri 화이트리스트에도 추가 필요.)
const NATIVE_CALLBACK = "com.hola.climbing://oauth/callback";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function providerSlug(provider: OAuthProvider): string {
  return PROVIDER_SLUG[provider];
}

// 백엔드가 처리를 마친 뒤 돌아올 프론트 콜백 주소.
// 웹은 현재 출처(www/non-www 그대로) + /oauth/callback, 네이티브는 커스텀 스킴.
function frontendCallback(): string {
  return isNative() ? NATIVE_CALLBACK : `${window.location.origin}/oauth/callback`;
}

/** 소셜 로그인 시작 — 백엔드 /authorize 로 이동. fetch 가 아니라 페이지 이동.
 *  백엔드가 302 로 provider 로그인 페이지로 보낸다. */
export async function startLogin(provider: OAuthProvider): Promise<void> {
  const base = (API_BASE ?? "/api").replace(/\/$/, "");
  const url = `${base}/auth/oauth/${PROVIDER_SLUG[provider]}/authorize?redirectUri=${encodeURIComponent(frontendCallback())}`;

  if (isNative()) {
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
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
