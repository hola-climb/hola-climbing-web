import api from "./client";
import type { BusinessHours, FeedVideo, Gym, GymDetail, GymGrade, GymReview, PageResponse, RawRecommendedVideo, RecommendedGym, Video } from "@/types/api";

export interface BoardPost {
  id: string;
  content: string;
  author: { id: string; nickname: string; profileImageUrl: string | null };
  isVerifiedAtGym: boolean;
  createdAt: string;
}

interface RawGymReview {
  id: number;
  gymId: number;
  userId: number;
  nickname?: string | null;
  profileImage?: string | null;
  rating: number;
  content: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** Map backend VideoSummaryResponse → FeedVideo (same shape, no `source`) */
function toGymVideo(raw: Omit<RawRecommendedVideo, "source">): FeedVideo {
  return {
    id: String(raw.id),
    userId: String(raw.userId),
    user: { nickname: raw.nickname ?? "사용자", profileImage: raw.profileImage ?? null },
    gymId: raw.gymId != null ? String(raw.gymId) : null,
    gymName: raw.gymName !== null ? String(raw.gymName) : null,
    title: raw.title,
    gymGrade: raw.gymGrade ?? null,
    grade: raw.gymGrade?.label ?? raw.grade ?? null,
    thumbnailUrl: raw.thumbnailUrl ?? raw.thumbnailPath,
    streamUrl: raw.streamUrl,
    durationSeconds: raw.durationSeconds,
    viewCount: raw.viewCount,
    likeCount: raw.likeCount,
    commentCount: raw.commentCount,
    source: "gym",
    createdAt: raw.createdAt,
  };
}

// ── Backend response shapes ───────────────────────────────────────────────────
interface RawDayHours {
  open: string | null;
  close: string | null;
}

interface RawGymSummary {
  id: number;
  name: string;
  address: string | null;
  thumbnailUrl: string | null;
  regionCode?: string | null;
  ratingAvg: number | string | null;
  ratingCount: number;
  // optional — present on some endpoints
  lat?: number | null;
  lng?: number | null;
  distanceKm?: number | null;
  isFavorited?: boolean;
  isFavorite?: boolean;
  isOpen?: boolean | null;
  businessHours?: Record<string, RawDayHours | null> | null;
}

interface RawRecommendedGym extends RawGymSummary {
  distanceKm: number;
  rankingDistance?: number | null;
  source: "style_match" | "nearby";
}

interface RawGymDetail extends RawGymSummary {
  description: string | null;
  phone: string | null;
  website: string | null;
  businessHours: Record<string, RawDayHours | null> | null;
  status: string | null;
}

/** Map backend Long id + lat/lng → client Gym (string id, latitude/longitude) */
function toGym(raw: RawGymSummary): Gym {
  return {
    id: String(raw.id),
    name: raw.name,
    address: raw.address ?? "",
    latitude: raw.lat ?? 0,
    longitude: raw.lng ?? 0,
    thumbnailUrl: raw.thumbnailUrl ?? null,
    ratingAvg: raw.ratingAvg != null ? Number(raw.ratingAvg) : null,
    ratingCount: raw.ratingCount ?? 0,
    distanceKm: raw.distanceKm != null ? Number(raw.distanceKm) : null,
    isFavorited: raw.isFavorite ?? raw.isFavorited ?? false,
    isOpen: raw.isOpen ?? null,
    businessHours: toBusinessHours(raw.businessHours),
  };
}

function toBusinessHours(bh: Record<string, RawDayHours | null> | null | undefined): BusinessHours | null {
  if (!bh) return null;
  const norm: Record<string, RawDayHours | null> = {};
  for (const [k, v] of Object.entries(bh)) norm[k.toLowerCase().slice(0, 3)] = v;
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const out = {} as BusinessHours;
  let hasAny = false;
  for (const d of days) {
    const v = norm[d];
    out[d] = v && v.open && v.close ? { open: v.open, close: v.close } : null;
    if (out[d]) hasAny = true;
  }
  return hasAny ? out : null;
}

function toRecommendedGym(raw: RawRecommendedGym): RecommendedGym {
  return {
    ...toGym(raw),
    distanceKm: raw.distanceKm != null ? Number(raw.distanceKm) : null,
    source: raw.source,
    rankingDistance: raw.rankingDistance != null ? Number(raw.rankingDistance) : null,
  };
}

function toGymDetail(raw: RawGymDetail): GymDetail {
  return {
    ...toGym(raw),
    phone: raw.phone ?? null,
    description: raw.description ?? null,
    videoCount: 0,
  };
}

export const gymService = {
  // ── Gyms ──────────────────────────────────────────────────────────────────

  search: (params: { keyword?: string; lat?: number; lng?: number; radiusKm?: number; page?: number; size?: number }) =>
    api.get<PageResponse<RawGymSummary>>("/gyms", { params }).then((res) => ({
      ...res,
      data: { ...res.data, content: res.data.content.map(toGym) },
    })) as Promise<{ data: PageResponse<Gym> }>,

  /** store를 거치지 않고 Gym[] 직접 반환 — 암장 검색 UI 전용 */
  searchRaw: (params: { keyword?: string; page?: number; size?: number }) =>
    api.get<PageResponse<RawGymSummary>>("/gyms", { params }).then((res) => ({
      ...res,
      data: res.data.content.map(toGym),
    })) as Promise<{ data: Gym[] }>,

  getNearby: (params: { lat: number; lng: number; radius?: number; size?: number }) =>
    api.get<RawGymSummary[]>("/gyms/nearby", { params }).then((res) => ({ ...res, data: res.data.map(toGym) })) as Promise<{ data: Gym[] }>,

  getGym: (id: string) => api.get<RawGymDetail>(`/gyms/${id}`).then((res) => ({ ...res, data: toGymDetail(res.data) })) as Promise<{ data: GymDetail }>,

  getGymVideos: (gymId: string, params?: { page?: number; size?: number; sort?: string; gymGradeId?: number | null }) =>
    api.get<PageResponse<Omit<RawRecommendedVideo, "source">>>(`/gyms/${gymId}/videos`, { params }).then((res) => ({
      ...res,
      data: { ...res.data, content: res.data.content.map(toGymVideo) },
    })) as Promise<{ data: PageResponse<FeedVideo> }>,

  // ── Grades (영상 등록용 활성 난이도) ────────────────────────────────────────

  getGrades: (gymId: string) => api.get<GymGrade[]>(`/gyms/${gymId}/grades`),

  // ── Reviews ────────────────────────────────────────────────────────────────

  getReviews: async (gymId: string, params?: { page?: number; size?: number }): Promise<{ data: PageResponse<GymReview> }> => {
    const { data } = await api.get<PageResponse<RawGymReview>>(`/gyms/${gymId}/reviews`, { params });
    return {
      data: {
        ...data,
        content: data.content.map((r) => ({
          id: String(r.id),
          gymId: String(r.gymId),
          user: { id: String(r.userId), nickname: r.nickname ?? "사용자", profileImage: r.profileImage ?? null },
          rating: r.rating,
          content: r.content,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      },
    };
  },

  createReview: async (gymId: string, rating: number, content: string): Promise<{ data: GymReview }> => {
    const { data: r } = await api.post<RawGymReview>(`/gyms/${gymId}/reviews`, { rating, content });
    return {
      data: {
        id: String(r.id),
        gymId: String(r.gymId),
        user: { id: String(r.userId), nickname: r.nickname ?? "사용자", profileImage: r.profileImage ?? null },
        rating: r.rating,
        content: r.content,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    };
  },

  updateReview: (reviewId: string, rating: number, content: string) =>
    api.patch(`/gyms/reviews/${reviewId}`, { rating, content }),

  deleteReview: (reviewId: string) => api.delete(`/gyms/reviews/${reviewId}`),

  // ── Favorites ─────────────────────────────────────────────────────────────

  addFavorite: (gymId: string) => api.post<{ isFavorited: boolean }>(`/favorites/gyms/${gymId}`),

  removeFavorite: (gymId: string) => api.delete<{ isFavorited: boolean }>(`/favorites/gyms/${gymId}`),

  getFavorites: (params?: { page?: number; size?: number }) =>
    api.get<PageResponse<RawGymSummary>>("/favorites/gyms", { params }).then((res) => ({
      ...res,
      data: { ...res.data, content: res.data.content.map(toGym) },
    })) as Promise<{ data: PageResponse<Gym> }>,

  // ── Board ─────────────────────────────────────────────────────────────────

  getBoard: (gymId: string, params?: { page?: number; size?: number }) => api.get<PageResponse<BoardPost>>(`/gyms/${gymId}/board`, { params }),

  createBoardPost: (gymId: string, content: string, currentLat?: number, currentLng?: number) => api.post<BoardPost>(`/gyms/${gymId}/board`, { content, currentLat, currentLng }),

  deleteBoardPost: (boardId: string) => api.delete(`/gyms/board/${boardId}`),

  // ── Recommendations (인증 필요 · 좌표 기반 개인화 추천) ──────────────────────

  getRecommendations: (params: { lat: number; lng: number; radius?: number; size?: number }) =>
    api.get<RawRecommendedGym[]>("/recommendations/gyms", { params }).then((res) => ({ ...res, data: res.data.map(toRecommendedGym) })) as Promise<{ data: RecommendedGym[] }>,
};
