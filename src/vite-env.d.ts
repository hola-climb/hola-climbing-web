/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 네이티브(Capacitor) 빌드에서 사용하는 백엔드 절대 베이스 URL (예: http://192.168.35.162:8080/api) */
  readonly VITE_API_BASE_URL: string
  /** Grafana Cloud Faro collector URL (Frontend Observability에서 발급). 없으면 관측 비활성화. */
  readonly VITE_FARO_URL: string
  /** 앱 버전 — Faro 릴리스 태깅용 */
  readonly VITE_APP_VERSION: string
  /** 소셜 로그인 client_id (공개값). 콘솔에서 발급. 미설정 시 해당 provider 비활성. */
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_KAKAO_CLIENT_ID: string
  readonly VITE_NAVER_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
