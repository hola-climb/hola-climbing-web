/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 네이티브(Capacitor) 빌드에서 사용하는 백엔드 절대 베이스 URL (예: http://192.168.35.162:8080/api) */
  readonly VITE_API_BASE_URL: string
  /** Grafana Cloud Faro collector URL (Frontend Observability에서 발급). 없으면 관측 비활성화. */
  readonly VITE_FARO_URL: string
  /** 앱 버전 — Faro 릴리스 태깅용 */
  readonly VITE_APP_VERSION: string
  /** Firebase 웹 푸시 설정 — Firebase Console > 프로젝트 설정 > 웹 앱에서 발급.
   *  네이티브(iOS/Android)는 google-services.json / GoogleService-Info.plist 를 사용하므로 불필요. */
  readonly VITE_FB_API_KEY: string
  readonly VITE_FB_AUTH_DOMAIN: string
  readonly VITE_FB_PROJECT_ID: string
  readonly VITE_FB_MESSAGING_SENDER_ID: string
  readonly VITE_FB_APP_ID: string
  /** 웹 푸시 VAPID 공개키 — Firebase Console > 클라우드 메시징 > 웹 푸시 인증서. 웹 전용. */
  readonly VITE_FB_VAPID_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
