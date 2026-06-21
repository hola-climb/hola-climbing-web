/// <reference types="vitest" />

import legacy from "@vitejs/plugin-legacy";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    legacy(),
    VitePWA({
      registerType: "autoUpdate",
      // 앱은 favicon.png 를 사용한다. 존재하지 않는 favicon.ico 를 참조하면
      // 브라우저 기본 요청이 404 가 되므로 실제 존재하는 에셋만 나열한다.
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      // dev 서버(HMR)에는 precache SW 를 등록하지 않는다. dev 에 SW 가 붙으면
      // 캐시된 옛 프로덕션 index.html 이 죽은 해시 청크(/assets/index-xxxx.js)를
      // 요청하다 404 → 흰 화면이 된다. PWA 동작 테스트는 `vite preview`(실빌드)로.
      manifest: {
        name: "올라 - 클라이밍 분석",
        short_name: "올라",
        description: "클라이밍 영상 AI 분석 & 암장 추천",
        theme_color: "#151515",
        background_color: "#F7F7F5",
        display: "standalone",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        // SPA navigation fallback(index.html)이 /api 풀페이지 이동까지 가로채면
        // 백엔드 OAuth redirect(/api/auth/oauth/*)가 SPA로 새서 /feed 로 튕긴다.
        // /api 로의 네비게이션은 가로채지 말고 서버(백엔드)로 그대로 보낸다.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // ffmpeg.wasm 은 내부 Web Worker 를 사용해 Vite dep 옵티마이저와 충돌한다.
    // 사전 번들 대상에서 제외해야 worker 가 정상 로드된다.
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "https://www.hola-climb.app",
        changeOrigin: true,
      },
      "/videos": {
        target: "https://www.hola-climb.app",
        changeOrigin: true,
      },
    },
  },
});
