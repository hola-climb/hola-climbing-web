import type { NavigationGuardNext, RouteLocationNormalized } from "vue-router";
import { START_LOCATION } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";

// 탭바에서 직접 진입하는 인증 필요 루트. 비로그인 시 /auth/login 으로 리다이렉트하지 않고
// (탭 전환이 무산되는 것처럼 보이므로) 로그인 바텀시트를 띄운다. 탭바가 모두 동일한
// Ionic 네이티브 href 네비게이션을 쓸 수 있게 해 selectedTab desync 를 막는다.
const sheetGuardedTabPaths = ["/records", "/my"];

export async function authGuard(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) {
  const authStore = useAuthStore();

  // Wait for session restoration (page refresh) before evaluating auth state,
  // otherwise a logged-in user is bounced to /auth/login on the first navigation.
  await authStore.initFromStorage();

  // Auth pages (login/register/password-reset) — accessible only when logged out
  const authPaths = ["/auth/login", "/auth/register", "/auth/password-reset"];
  const isAuthPath = authPaths.some((path) => to.path.startsWith(path));

  // Public content paths — accessible without authentication (per spec).
  // 소셜 콜백/가입 단계는 로그인 전 상태에서 접근해야 하므로 공개 취급한다.
  const publicPaths = ["/feed", "/explore", "/verify-email", "/videos", "/users", "/gyms", "/oauth/callback", "/auth/social-signup"];
  const isPublicPath = publicPaths.some((path) => to.path.startsWith(path));

  // 백엔드 인증 메일 링크가 /feed?token=... 형태로 오는 경우 → /verify-email로 리다이렉트
  if (to.path === "/feed" && to.query.token) {
    return next({ path: "/verify-email", query: { token: to.query.token } });
  }

  // Already authenticated → keep auth pages out of reach, send to feed
  if (isAuthPath && authStore.isAuthenticated) {
    return next("/feed");
  }

  // Admin-only routes require ADMIN role
  if (to.meta.requiresAdmin && authStore.user?.role !== "ADMIN") {
    return next(authStore.isAuthenticated ? "/feed" : "/auth/login");
  }

  // Tab roots (기록/마이): show the login bottom sheet instead of redirecting,
  // so the tab bar can stay on Ionic's native href navigation everywhere.
  if (sheetGuardedTabPaths.includes(to.path) && !authStore.isAuthenticated) {
    useUIStore().openLoginSheet();
    // 앱 내 탭 전환이면 현재 화면 유지(next(false)), 콜드 스타트/딥링크면 공개 피드로.
    return from === START_LOCATION ? next("/feed") : next(false);
  }

  // Private routes require authentication; preserve intended destination
  if (!isAuthPath && !isPublicPath && !authStore.isAuthenticated) {
    return next({ path: "/auth/login", query: { redirect: to.fullPath } });
  }

  next();
}
