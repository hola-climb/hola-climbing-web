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
  /** 약관 전문 — '보기'에서 렌더링. 줄바꿈은 \n 으로 내려온다. */
  content: string;
}

/** GET /api/terms/agreement-status — 약관별 동의 여부 (인증 필요).
 *  공개 Term 과 달리 content 가 없고 agreed 가 추가된다. */
export interface TermAgreement {
  termId: number;
  type: string;
  version: string;
  title: string;
  required: boolean;
  agreed: boolean;
}

export interface AgreementStatus {
  allRequiredAgreed: boolean;
  terms: TermAgreement[];
}

// ── Social login (OAuth) ───────────────────────────────────────────────────────

export enum OAuthProvider {
  GOOGLE = "GOOGLE",
  KAKAO = "KAKAO",
  NAVER = "NAVER",
}

/** 로그인 / 소셜가입 공통 토큰 응답 모양. */
export interface LoginTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

/** 백엔드 OAuth redirect 흐름은 프론트가 SDK/인가코드를 직접 다루지 않는다.
 *  프론트는 /authorize 로 페이지 이동 → 백엔드가 provider·콜백을 처리 →
 *  프론트 /oauth/callback 으로 oauthCode 를 들고 돌아옴 → /result 로 결과 조회. */

/** /result 응답 상태.
 *  LOGGED_IN: 기존 소셜 유저(token 채워짐) / SIGNUP_REQUIRED: 신규(signupToken+프리필) /
 *  EMAIL_ALREADY_EXISTS: 같은 이메일의 자체가입 계정 존재(토큰·signupToken 둘 다 없음). */
export type OAuthStatus = "LOGGED_IN" | "SIGNUP_REQUIRED" | "EMAIL_ALREADY_EXISTS";

/** POST /api/auth/oauth/result — 콜백에서 받은 1회용 oauthCode 로 로그인 결과 조회. */
export interface OAuthResultRequest {
  code: string;
}

export interface OAuthResultResponse {
  status: OAuthStatus;
  signupRequired: boolean;
  /** 상태에 따라 일부만 채워진다(LOGGED_IN→token, SIGNUP_REQUIRED→signupToken+프리필). */
  token?: LoginTokens | null;
  signupToken?: string | null;
  email?: string | null;
  suggestedNickname?: string | null;
  profileImage?: string | null;
}

/** POST /api/auth/oauth/signup — 신규 소셜 유저의 닉네임/약관 동의 후 가입 완료. */
export interface OAuthSignupRequest {
  signupToken: string;
  nickname: string;
  termsAgreed: Array<{ termId: number; agreed: boolean }>;
}

// ── Video ─────────────────────────────────────────────────────────────────────

export type AnalysisStatus = "pending" | "analyzing" | "done" | "failed";

export interface VideoUser {
  id: string;
  nickname: string;
  profileImage: string | null;
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
  nickname?: string | null; // 작성자 닉네임 (목록 응답이 내려줄 때만 존재)
  profileImage?: string | null; // 작성자 프로필 이미지 signed URL
  gymId: number | null;
  title: string | null;
  grade?: string | null; // legacy string (older backend)
  gymGrade?: GymGrade | null; // structured grade (current backend)
  gymName: string | null;
  thumbnailPath: string | null;
  thumbnailUrl?: string | null; // signed URL (백엔드가 내려줄 때만 존재)
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
  user: { nickname: string; profileImage: string | null };
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

/** PATCH /api/videos/{id} 요청 바디 — 수정 가능한 필드만 */
export interface UpdateVideoPayload {
  title?: string | null;
  description?: string | null;
  isPublic?: boolean;
  gymId?: number | null;
  gymGradeId?: number | null;
  recordedDate?: string | null; // YYYY-MM-DD
}

/** POST /api/videos/thumbnail 응답 */
export interface ThumbnailUploadResponse {
  thumbnailPath: string;
  thumbnailUrl: string;
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
  isOpen: boolean | null;
  businessHours?: BusinessHours | null;
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
  videoCount: number;
}

/** GET /api/recommendations/gyms — backend RecommendedGymResponse (+ distance/style fields) */
export interface RecommendedGym extends Gym {
  source: "style_match" | "nearby";
  rankingDistance: number | null; // pgvector cosine distance, style ranking 불가 시 null
}

/** POST /api/reports — 신고 대상 종류 */
export type ReportTargetType = "video" | "comment" | "user";

/** POST /api/reports — 신고 사유 카테고리 */
export enum ReportCategory {
  OBSCENE = "obscene",
  COPYRIGHT = "copyright",
  HATE = "hate",
  SPAM = "spam",
  ETC = "etc",
}

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  [ReportCategory.OBSCENE]: "음란물",
  [ReportCategory.COPYRIGHT]: "저작권 침해",
  [ReportCategory.HATE]: "욕설/혐오",
  [ReportCategory.SPAM]: "스팸/광고",
  [ReportCategory.ETC]: "기타",
};

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

export interface BusinessHourSlot {
  open: string;
  close: string;
}

export interface BusinessHours {
  mon: BusinessHourSlot | null;
  tue: BusinessHourSlot | null;
  wed: BusinessHourSlot | null;
  thu: BusinessHourSlot | null;
  fri: BusinessHourSlot | null;
  sat: BusinessHourSlot | null;
  sun: BusinessHourSlot | null;
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
  nextCursor?: string | null;
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
