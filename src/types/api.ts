// Global TypeScript types — API response shapes and domain enums

// ── Common ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message?: string;
  data: T;
  timestamp: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  bio: string | null;
  emailVerified: boolean;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  createdAt: string;
  role?: "USER" | "ADMIN";
  // Not in API spec yet — deferred
  preferredRegion?: string | null;
  climbingExperienceMonths?: number | null;
  mainGymId?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  nickname: string;
  termsAgreed: Array<{ termId: number; agreed: boolean }>;
}

/** GET /api/terms — backend TermResponse */
export interface Term {
  termId: number;
  type: string;
  version: string;
  required: boolean;
  title: string;
}

// ── Video ─────────────────────────────────────────────────────────────────────

export type AnalysisStatus = "pending" | "analyzing" | "done" | "failed";

export interface VideoUser {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
}

export interface VideoGym {
  id: string;
  name: string;
}

export interface Video {
  id: string;
  user: VideoUser;
  title: string | null;
  grade: string | null; // display label (= gymGrade.label, gym color name)
  gymGrade: GymGrade | null; // structured grade (id/label/difficultyOrder)
  description: string | null;
  gym: VideoGym | null;
  gymName: string | null;
  streamingUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  status: AnalysisStatus;
  progress: number;
  isPublic: boolean; // was "visibility: Visibility"
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  analysis: AnalysisResult | null; // was "analysisResult"
  createdAt: string;
}

/** Raw GET /api/recommendations/videos item — backend RecommendedVideoResponse */
export interface RawRecommendedVideo {
  id: number;
  userId: number;
  gymId: number | null;
  title: string | null;
  grade?: string | null; // legacy string (older backend)
  gymGrade?: GymGrade | null; // structured grade (current backend)
  gymName: string | null;
  thumbnailPath: string | null;
  streamUrl: string | null;
  durationSeconds: number | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  source: string;
  createdAt: string;
  recordedDate?: string | null; // YYYY-MM-DD (GET /api/videos 응답)
}

/** UI feed card — derived from RawRecommendedVideo */
export interface FeedVideo {
  id: string;
  userId: string;
  gymId: string | null;
  title: string | null;
  gymName: string | null;
  grade: string | null; // display label (= gymGrade.label)
  gymGrade: GymGrade | null;
  thumbnailUrl: string | null;
  streamUrl: string | null;
  durationSeconds: number | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  source: string;
  createdAt: string;
  recordedDate?: string | null; // YYYY-MM-DD (촬영일, GET /api/videos 응답)
}

export interface TechniqueTag {
  key: string;
  confidence: number;
  userFeedback: "correct" | "incorrect" | null;
}

export interface AnalysisResult {
  videoId: string;
  status?: AnalysisStatus;
  modelVersion: string | null;
  eTrajectory: number | null;
  eArm: number | null;
  techniqueLabels: Record<string, number>; // raw API: { high_step: 3, flagging: 2, ... }
  techniques: TechniqueTag[]; // derived for UI components
  timeline: Array<{ startSec: number; endSec: number; label: string; confidence: number }>;
  skeletonOverlayUrl: string | null;
  analyzedAt: string;
  isDynamic?: boolean | null;
  // kept for legacy UI compatibility
  problemType?: "DYNAMIC" | "STATIC" | null;
}

export interface VideoStatus {
  id: string;
  status: AnalysisStatus;
  progress: number;
  stage: string | null;
  estimatedSecondsRemaining: number | null;
}

export interface UploadUrlPayload {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  objectPath: string;
  expiresIn: number;
}

export interface RegisterVideoPayload {
  objectPath: string;
  recordedDate: string; // YYYY-MM-DD (required)
  gymId: number; // required
  gymGradeId: number; // required — active grade id of the gym
  title?: string;
  description?: string;
  thumbnailPath?: string;
  durationSeconds?: number;
  isPublic: boolean;
}

/** GET /api/gyms/{gymId}/grades — backend GymGradeResponse */
export interface GymGrade {
  id: number;
  gymId: number;
  label: string;
  difficultyOrder: number;
}

export interface Comment {
  id: string;
  videoId: string;
  parentId: string | null;
  user: VideoUser;
  content: string; // was "body"
  createdAt: string;
  updatedAt: string | null;
  replies?: Comment[];
}

// ── User / Follow / Block ─────────────────────────────────────────────────────

/** Public profile from GET /api/users/{userId} */
export interface UserPublicProfile {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  videoCount: number;
  isFollowing: boolean;
  isBlocked: boolean;
}

/** Item in follower / following list */
export interface FollowUser {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  isFollowing: boolean;
}

/** Item in block list */
export interface BlockedUser {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  blockedAt: string;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/** GET /api/stats/me — backend UserStatsResponse */
export interface UserStats {
  userId: number;
  totalVideos: number;
  totalClimbingSeconds: number;
  techniqueCounts: Record<string, number>;
  lastClimbedAt: string | null;
  dynamicCount: number;
  staticCount: number;
  isDynamic: boolean;
}

/** Public stats for another user — GET /api/stats/users/{userId} */
export interface PublicUserStats {
  userId: number;
  totalVideos: number;
  totalClimbingSeconds: number;
  techniqueCounts: Record<string, number>;
  // lastClimbedAt: string | null;
  dynamicCount: number;
  staticCount: number;
  isDynamic: boolean;
}

/**
 * EfficiencyStats — API excluded from spec (stat/me/efficiency not implemented).
 * Kept for mock compatibility until fully removed.
 */
export interface EfficiencyStats {
  summary: {
    avgETrajectory: number;
    avgEArm: number;
    trend: "up" | "down" | "flat";
  };
  series: Array<{
    bucket: string;
    eTrajectory: number;
    eArm: number;
    videoCount: number;
  }>;
}

export interface TechniqueStats {
  techniqueCounts: Record<string, number>;
  mostUsed: string;
  leastUsed: string;
}

/** UI type for StatGraph — derived from TechniqueStats.techniqueCounts */
export interface TechniqueFrequency {
  key: string;
  count: number;
}

/** UI calendar day — used by RecordCalendar component */
export interface CalendarDay {
  date: string; // YYYY-MM-DD
  hasRecord: boolean;
  gymName: string | null;
}

/** GET /api/stats/me/calendar 의 days[] 항목 — backend CalendarDayResponse */
export interface CalendarMonthItem {
  date: string;
  logCount: number;
  totalProblems: number;
  videoCount: number;
}

/** GET /api/stats/me/calendar 응답 — backend CalendarMonthResponse (집계 + days) */
export interface CalendarMonth {
  year: number;
  month: number;
  totalVideos: number;
  totalProblems: number;
  totalVideoDurationSeconds: number;
  totalGymVisits: number;
  days: CalendarMonthItem[];
}

/** Raw API response item from GET /api/stats/me/calendar/{date} — backend ClimbingLogResponse */
export interface CalendarDayRecord {
  id: number;
  userId: number;
  gymId: number;
  climbedOn: string;
  gradeCounts: Record<string, number>;
  totalProblems: number;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 클라이밍 기록 — POST/GET/PATCH /api/climbing-logs — backend ClimbingLogResponse */
export interface ClimbingLog {
  id: number;
  userId: number;
  gymId: number;
  climbedOn: string; // YYYY-MM-DD (KST 로컬 날짜)
  gradeCounts: Record<string, number>; // 난이도 라벨 → 푼 문제 수
  totalProblems: number;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST/PATCH /api/climbing-logs 요청 바디 — backend Create/UpdateClimbingLogRequest */
export interface ClimbingLogPayload {
  gymId: number;
  climbedOn: string;
  gradeCounts: Record<string, number>;
  memo?: string | null;
}

// ── Gym ───────────────────────────────────────────────────────────────────────

export interface Gym {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  thumbnailUrl: string | null;
  ratingAvg: number | null; // was "rating"
  ratingCount: number; // was "reviewCount"
  distanceKm: number | null;
  isFavorited: boolean;
  // Kept for mock data / future API support
  logoUrl?: string | null;
  operatingHours?: OperatingHours | null;
  priceInfo?: string | null;
  difficultySystem?: string | null;
  currentSetting?: string | null;
}

export interface GymDetail extends Gym {
  phone: string | null;
  description: string | null;
  photos: string[];
  videoCount: number;
  businessHours: string | null;
}

/** GET /api/gyms/{id}/photos — backend GymPhotoResponse */
export interface GymPhoto {
  id: string;
  url: string;
  caption: string | null;
}

/** GET /api/gyms/{id}/reviews — backend GymReviewResponse (+ resolved user) */
export interface GymReview {
  id: string;
  gymId: string;
  user: VideoUser;
  rating: number;
  content: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** Chat — backend ChatMessageResponse (+ resolved user) */
export interface ChatMessage {
  id: string;
  roomId: string;
  user: VideoUser;
  content: string;
  verifiedAtGym: boolean;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  gymId: string;
  name: string;
}

export interface OperatingHours {
  mon: string | null;
  tue: string | null;
  wed: string | null;
  thu: string | null;
  fri: string | null;
  sat: string | null;
  sun: string | null;
}

// ── Notification ──────────────────────────────────────────────────────────────

export type NotificationType = "comment" | "reply" | "like" | "follow" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  targetType: "video" | "user" | "gym" | null;
  targetId: string | null;
  actor: VideoUser | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPage extends PageResponse<Notification> {
  unreadCount: number;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

// ── API error ─────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert raw API analysis response (techniqueLabels + timeline) to TechniqueTag[].
 * Used in video service and store to derive the techniques array for UI components.
 */
export function parseTechniqueTags(techniqueLabels: Record<string, number>, timeline: Array<{ label: string; confidence: number }>): TechniqueTag[] {
  const confMap: Record<string, number> = {};
  for (const t of timeline) {
    if (!confMap[t.label] || t.confidence > confMap[t.label]) {
      confMap[t.label] = t.confidence;
    }
  }
  return Object.entries(techniqueLabels)
    .filter(([key, count]) => key.trim() !== "" && count > 0)
    .map(([key]) => ({
      key,
      confidence: confMap[key] ?? 0.8,
      userFeedback: null,
    }));
}
