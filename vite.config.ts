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
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
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
    },
  },
});
