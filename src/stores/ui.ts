import { defineStore } from 'pinia'
import { nextTick, ref } from 'vue'
import { notificationService } from '@/services/notification'

/** 토스트에 띄울 인라인 액션 버튼 (예: "결과 보기 →") */
export interface ToastAction {
  text: string
  handler: () => void
}

export const useUIStore = defineStore('ui', () => {
  // state
  const showLoginSheet = ref(false)
  const showOnboardingBanner = ref(false)
  const toastMessage = ref('')
  const toastColor = ref<'success' | 'danger' | 'warning'>('success')
  const isToastOpen = ref(false)
  const toastAction = ref<ToastAction | null>(null)
  const unreadCount = ref(0)

  // actions
  async function showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success',
    action: ToastAction | null = null,
  ) {
    // Reset first so a back-to-back toast still triggers IonToast's false→true transition.
    isToastOpen.value = false
    await nextTick()
    toastMessage.value = message
    toastColor.value = color
    toastAction.value = action
    // 액션 버튼이 있으면 사용자가 누를 시간을 더 준다.
    isToastOpen.value = true
  }

  async function refreshUnreadCount() {
    try {
      const { data } = await notificationService.getUnreadCount()
      unreadCount.value = data
    } catch {
      // best-effort; ignore (e.g. logged out)
    }
  }

  function setUnreadCount(n: number) {
    unreadCount.value = Math.max(0, n)
  }

  function dismissToast() {
    isToastOpen.value = false
    toastAction.value = null
  }

  function openLoginSheet() {
    showLoginSheet.value = true
  }

  function closeLoginSheet() {
    showLoginSheet.value = false
  }

  return {
    showLoginSheet,
    showOnboardingBanner,
    toastMessage,
    toastColor,
    isToastOpen,
    toastAction,
    unreadCount,
    showToast,
    refreshUnreadCount,
    setUnreadCount,
    dismissToast,
    openLoginSheet,
    closeLoginSheet,
  }
})
