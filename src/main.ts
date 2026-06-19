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

const pinia = createPinia()
const app = createApp(App).use(IonicVue).use(pinia).use(router)

router.isReady().then(async () => {
  // Restore session from localStorage BEFORE mounting so the router guard
  // sees the authenticated state on first navigation (e.g. page refresh).
  const authStore = useAuthStore()
  await authStore.initFromStorage()

  app.mount('#app')
})
