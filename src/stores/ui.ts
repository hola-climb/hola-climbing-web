import { defineStore } from 'pinia'
import { nextTick, ref } from 'vue'
import { notificationService } from '@/services/notification'

export const useUIStore = defineStore('ui', () => {
  // state
  const showLoginSheet = ref(false)
  const showOnboardingBanner = ref(false)
  const toastMessage = ref('')
  const toastColor = ref<'success' | 'danger' | 'warning'>('success')
  const isToastOpen = ref(false)
  const unreadCount = ref(0)

  // actions
  async function showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    // Reset first so a back-to-back toast still triggers IonToast's false→true transition.
    isToastOpen.value = false
    await nextTick()
    toastMessage.value = message
    toastColor.value = color
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
    unreadCount,
    showToast,
    refreshUnreadCount,
    setUnreadCount,
    dismissToast,
    openLoginSheet,
    closeLoginSheet,
  }
})
