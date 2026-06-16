/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 네이티브(Capacitor) 빌드에서 사용하는 백엔드 절대 베이스 URL (예: http://192.168.35.162:8080/api) */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
