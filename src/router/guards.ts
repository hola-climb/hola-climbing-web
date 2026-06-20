import type { NavigationGuardNext, RouteLocationNormalized } from "vue-router";
import { useAuthStore } from "@/stores/auth";

export async function authGuard(to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) {
  const authStore = useAuthStore();

  // Wait for session restoration (page refresh) before evaluating auth state,
  // otherwise a logged-in user is bounced to /auth/login on the first navigation.
  await authStore.initFromStorage();

  // Auth pages (login/register/password-reset) — accessible only when logged out
  const authPaths = ["/auth/login", "/auth/register", "/auth/password-reset"];
  const isAuthPath = authPaths.some((path) => to.path.startsWith(path));

  // Public content paths — accessible without authentication (per spec).
  // 소셜 콜백/가입 단계는 로그인 전 상태에서 접근해야 하므로 공개 취급한다.
  const publicPaths = ["/feed", "/explore", "/verify-email", "/videos", "/users", "gyms", "/auth/oauth", "/auth/social-signup"];
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

  // Private routes require authentication; preserve intended destination
  if (!isAuthPath && !isPublicPath && !authStore.isAuthenticated) {
    return next({ path: "/auth/login", query: { redirect: to.fullPath } });
  }

  next();
}
