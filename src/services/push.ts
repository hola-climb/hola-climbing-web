import { Capacitor } from '@capacitor/core'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import { initializeApp, getApps } from 'firebase/app'
import { notificationService } from './notification'

/**
 * FCM 푸시 토큰 수명주기 관리.
 *
 * - 네이티브(iOS/Android): @capacitor-firebase/messaging 가 google-services.json /
 *   GoogleService-Info.plist 를 통해 FCM 토큰을 발급한다. (Firebase 웹 config 불필요)
 * - 웹(PWA): firebase JS SDK 를 초기화하고 VAPID 키로 토큰을 발급한다.
 *   public/firebase-messaging-sw.js 서비스워커가 백그라운드 메시지를 처리한다.
 *
 * 등록/해제는 백엔드 계약과 동일:
 *   POST   /api/users/me/device-tokens { token, platform }
 *   DELETE /api/users/me/device-tokens { token }
 */

const STORAGE_KEY = 'fcm_device_token'

function platform(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform()
  return p === 'ios' || p === 'android' ? p : 'web'
}

/** 웹: firebase 앱 초기화 (한 번만). 설정값이 비어 있으면 false 반환 → 웹 푸시 비활성. */
function ensureWebFirebase(): boolean {
  const cfg = {
    apiKey: import.meta.env.VITE_FB_API_KEY,
    authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FB_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FB_APP_ID,
  }
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) return false
  if (getApps().length === 0) initializeApp(cfg)
  return true
}

/** 알림 권한을 요청하고 허용 여부를 반환한다. */
async function requestPermission(): Promise<boolean> {
  const { receive } = await FirebaseMessaging.requestPermissions()
  return receive === 'granted'
}

/**
 * 푸시 토큰을 발급받아 서버에 등록한다.
 * 로그인 직후 / 세션 복원 후 호출. 권한 거부·미지원 환경이면 조용히 종료한다.
 */
async function register(): Promise<void> {
  try {
    const isNative = Capacitor.isNativePlatform()

    // 웹은 SW + Notification API + firebase config 가 모두 있어야 동작
    if (!isNative) {
      if (!('serviceWorker' in navigator) || !('Notification' in window)) return
      if (!ensureWebFirebase()) {
        if (import.meta.env.DEV) console.warn('[push] firebase web config 미설정 — 웹 푸시 비활성')
        return
      }
    }

    if (!(await requestPermission())) return

    const vapidKey = import.meta.env.VITE_FB_VAPID_KEY
    const { token } = await FirebaseMessaging.getToken(
      !isNative && vapidKey ? { vapidKey } : undefined,
    )
    if (!token) return

    await notificationService.registerDeviceToken(token, platform())
    localStorage.setItem(STORAGE_KEY, token)
  } catch (err) {
    // 권한 거부·미지원 등은 치명적 실패가 아니므로 삼킨다.
    if (import.meta.env.DEV) console.error('[push] register 실패', err)
  }
}

/**
 * 서버에서 토큰을 제거하고 로컬 토큰을 폐기한다. 로그아웃 시 호출.
 */
async function unregister(): Promise<void> {
  const token = localStorage.getItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_KEY)
  try {
    if (token) await notificationService.removeDeviceToken(token)
    // 네이티브는 토큰 자체를 폐기해 더 이상 수신하지 않도록 한다.
    if (Capacitor.isNativePlatform()) await FirebaseMessaging.deleteToken()
  } catch (err) {
    if (import.meta.env.DEV) console.error('[push] unregister 실패', err)
  }
}

export const pushService = {
  register,
  unregister,
}
