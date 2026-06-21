import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import { IonicVue } from '@ionic/vue'

/* Ionic core CSS */
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'

/* Hola design tokens */
import './theme/variables.css'
import './assets/global.css'

import { useAuthStore } from './stores/auth'
import { initObservability } from './services/observability'

// 부팅 단계 에러까지 잡도록 앱 생성 전에 가장 먼저 초기화 (PROD 전용)
initObservability()

// ── DEV 자가치유: localhost 에 남아있는 prod 서비스워커/캐시 제거 ──────────
// `vite preview`(실빌드)로 한번 띄웠던 localhost 는 prod SW 가 등록돼,
// 이후 dev 서버(5173)에서도 캐시된 옛 prod index.html 을 돌려준다. 그 안의
// 죽은 해시 청크(/assets/index-xxxx.js)가 dev 에 없어 404 → 흰 화면이 된다.
// dev 빌드에서는 모든 SW 를 해제하고 캐시를 비워 이 상태를 자동 복구한다.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs.length === 0) return
    Promise.all(regs.map((r) => r.unregister()))
      .then(() => (window.caches ? caches.keys() : Promise.resolve([])))
      .then((keys) => Promise.all((keys as string[]).map((k) => caches.delete(k))))
      .then(() => window.location.reload())
  })
}

// ── 새 배포 후 stale 청크로 인한 흰 화면 복구 ────────────────────────────
// autoUpdate SW + lazy 라우트 조합에서, 재배포로 해시 청크 파일명이 바뀌면
// 메모리에 남아있던 옛 페이지(특히 iOS standalone PWA)가 사라진 청크를
// import 하다 실패해 흰 화면이 된다. 이때 1회 새로고침으로 최신 청크를 받는다.
// sessionStorage 플래그로 무한 새로고침 루프를 방지한다.
const CHUNK_RELOAD_KEY = 'hola:chunk-reloaded'
function reloadOnceForStaleChunk() {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  window.location.reload()
}
router.onError((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  if (/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(msg)) {
    reloadOnceForStaleChunk()
  }
})
window.addEventListener('vite:preloadError', () => reloadOnceForStaleChunk())
// 정상 네비게이션이 한 번 끝나면 플래그를 비워, 다음 배포 때 다시 복구되게 한다.
router.afterEach(() => sessionStorage.removeItem(CHUNK_RELOAD_KEY))

const pinia = createPinia()
const app = createApp(App).use(IonicVue).use(pinia).use(router)

router.isReady().then(async () => {
  // Restore session from localStorage BEFORE mounting so the router guard
  // sees the authenticated state on first navigation (e.g. page refresh).
  const authStore = useAuthStore()
  await authStore.initFromStorage()

  app.mount('#app')
})
