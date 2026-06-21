import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { authGuard } from './guards'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/feed',
  },

  // ── Main tab layout ───────────────────────────────────────────────────
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      {
        path: 'feed',
        component: () => import('@/pages/feed/FeedPage.vue'),
      },
      {
        path: 'records',
        component: () => import('@/pages/records/RecordsPage.vue'),
      },
      {
        path: 'explore',
        component: () => import('@/pages/explore/ExplorePage.vue'),
      },
      {
        path: 'my',
        component: () => import('@/pages/my/MyPage.vue'),
      },
    ],
  },

  // ── Upload ────────────────────────────────────────────────────────────
  {
    path: '/upload',
    component: () => import('@/pages/upload/UploadPage.vue'),
  },

  // ── Climbing log (작성/수정) ───────────────────────────────────────────
  {
    path: '/climbing-log',
    component: () => import('@/pages/records/ClimbingLogPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/climbing-log/:id',
    component: () => import('@/pages/records/ClimbingLogPage.vue'),
    meta: { requiresAuth: true },
  },

  // ── Video detail ──────────────────────────────────────────────────────
  {
    path: '/videos/:id',
    component: () => import('@/pages/feed/VideoDetailPage.vue'),
  },

  // ── Gym detail ────────────────────────────────────────────────────────
  {
    path: '/gyms/:id',
    component: () => import('@/pages/explore/GymDetailPage.vue'),
  },

  // ── Auth ──────────────────────────────────────────────────────────────
  {
    path: '/auth',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: 'login',
        component: () => import('@/pages/auth/LoginPage.vue'),
      },
      {
        path: 'register',
        component: () => import('@/pages/auth/RegisterPage.vue'),
      },
      {
        path: 'password-reset',
        component: () => import('@/pages/auth/PasswordResetPage.vue'),
      },
      // 소셜 최초 로그인 시 닉네임/약관 동의 단계 (F-01-05)
      {
        path: 'social-signup',
        component: () => import('@/pages/auth/SocialSignupPage.vue'),
      },
    ],
  },

  // ── 소셜 로그인 콜백 (백엔드가 redirectUri 로 지정하는 프론트 주소) ──────────
  // 웹: hola-climb.app/oauth/callback?oauthCode= / 네이티브: 딥링크가 이 라우트로 라우팅
  {
    path: '/oauth/callback',
    component: () => import('@/pages/auth/OAuthCallbackPage.vue'),
  },

  // ── Email verification (딥링크: hola-climb.app/verify-email?token=) ────
  {
    path: '/verify-email',
    component: () => import('@/pages/auth/EmailVerifyPage.vue'),
  },

  // ── My video list ─────────────────────────────────────────────────────
  {
    path: '/my/videos',
    component: () => import('@/pages/my/MyVideosPage.vue'),
    meta: { requiresAuth: true },
  },

  // ── My video detail (내 영상 + AI 분석) ──────────────────────────────────
  {
    path: '/my/videos/:id',
    component: () => import('@/pages/feed/VideoDetailPage.vue'),
    meta: { requiresAuth: true },
  },

  // ── Notifications ─────────────────────────────────────────────────────
  {
    path: '/my/notifications',
    component: () => import('@/pages/my/NotificationsPage.vue'),
  },

  // ── Settings ──────────────────────────────────────────────────────────
  {
    path: '/my/settings',
    component: () => import('@/pages/my/SettingsPage.vue'),
  },

  // ── Terms agreement status ────────────────────────────────────────────
  {
    path: '/my/terms',
    component: () => import('@/pages/my/TermsAgreementPage.vue'),
    meta: { requiresAuth: true },
  },

  // ── Favorite gyms ─────────────────────────────────────────────────────
  {
    path: '/my/favorites',
    component: () => import('@/pages/my/FavoriteGymsPage.vue'),
    meta: { requiresAuth: true },
  },

  // ── Block management (users) ──────────────────────────────────────────
  {
    path: '/my/blocks',
    component: () => import('@/pages/my/BlockListPage.vue'),
    meta: { requiresAuth: true },
  },

  // ── Follow list (followers / following) ───────────────────────────────
  {
    path: '/users/:id/follows',
    component: () => import('@/pages/my/FollowListPage.vue'),
  },

  // ── Profile (other user) ──────────────────────────────────────────────
  {
    path: '/users/:id',
    component: () => import('@/pages/my/UserProfilePage.vue'),
  },

  // ── Admin ─────────────────────────────────────────────────────────────
  {
    path: '/admin',
    component: () => import('@/pages/admin/AdminPage.vue'),
    meta: { requiresAdmin: true },
  },

  // ── Fallback ──────────────────────────────────────────────────────────
  {
    path: '/:pathMatch(.*)*',
    redirect: '/feed',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(authGuard)

export default router
