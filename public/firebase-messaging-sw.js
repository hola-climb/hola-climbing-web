/* eslint-disable no-undef */
/**
 * 웹 푸시 백그라운드 수신 서비스워커.
 * firebase JS SDK 의 getToken() 이 기본으로 이 파일(/firebase-messaging-sw.js)을 등록한다.
 *
 * 주의: 서비스워커는 import.meta.env 를 쓸 수 없으므로 firebaseConfig 값을
 * Firebase Console > 프로젝트 설정 > 웹 앱의 실제 값으로 직접 채워야 한다.
 * (messagingSenderId / appId 등은 공개되어도 무방한 클라이언트 식별자다.)
 */
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD4V6dZjM-ICFyVqH7oD9bXfuEyc-pqSmQ",
  authDomain: "hola-climbing-fcm.firebaseapp.com",
  projectId: "hola-climbing-fcm",
  messagingSenderId: "839865423692",
  appId: "1:839865423692:web:2a6567ebccd8150e2a21e9",
});

const messaging = firebase.messaging();

// 백그라운드 메시지 → OS 알림 표시.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "올라";
  self.registration.showNotification(title, {
    body: payload.notification?.body ?? "",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    data: payload.data ?? {},
  });
});

// 알림 클릭 → 앱 포커스 + 대상 경로로 이동.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let path = "/";
  if (data.targetId) {
    if (data.targetType === "video") path = `/videos/${data.targetId}`;
    else if (data.targetType === "user") path = `/users/${data.targetId}`;
    else if (data.targetType === "gym") path = `/gyms/${data.targetId}`;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(path);
          return client.focus();
        }
      }
      return self.clients.openWindow(path);
    }),
  );
});
