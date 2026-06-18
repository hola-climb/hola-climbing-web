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
    ],
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
    component: () => import('@/pages/my/MyVideoDetailPage.vue'),
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
