import api from "./client";
import type { FeedVideo, Gym, GymDetail, GymGrade, GymPhoto, GymReview, OperatingHours, PageResponse, RawRecommendedVideo, RecommendedGym, Video } from "@/types/api";
import { resolveUser, resolveUsers } from "./userResolver";

export interface BoardPost {
  id: string;
  content: string;
  author: { id: string; nickname: string; profileImageUrl: string | null };
  isVerifiedAtGym: boolean;
  createdAt: string;
}

interface RawGymPhoto {
  id: number;
  gcsPath: string;
  caption: string | null;
  displayOrder: number;
}
interface RawGymReview {
  id: number;
  gymId: number;
  userId: number;
  rating: number;
  content: string | null;
  createdAt: string;
  updatedAt: string | null;
}

function toGymPhoto(raw: RawGymPhoto): GymPhoto {
  return { id: String(raw.id), url: raw.gcsPath, caption: raw.caption };
}

/** Map backend VideoSummaryResponse → FeedVideo (same shape, no `source`) */
function toGymVideo(raw: Omit<RawRecommendedVideo, "source">): FeedVideo {
  return {
    id: String(raw.id),
    userId: String(raw.userId),
    gymId: raw.gymId != null ? String(raw.gymId) : null,
    gymName: raw.gymName !== null ? String(raw.gymName) : null,
    title: raw.title,
    gymGrade: raw.gymGrade ?? null,
    grade: raw.gymGrade?.label ?? raw.grade ?? null,
    thumbnailUrl: raw.thumbnailPath,
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
  photos: Array<{ id: number; gcsPath: string; caption: string | null; displayOrder: number }> | null;
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
    isFavorited: raw.isFavorited ?? false,
  };
}

/** Map backend businessHours Map → client OperatingHours ("09:00 - 22:00" | null) */
function toOperatingHours(bh: Record<string, RawDayHours | null> | null): OperatingHours | null {
  if (!bh) return null;
  const norm: Record<string, RawDayHours | null> = {};
  for (const [k, v] of Object.entries(bh)) norm[k.toLowerCase().slice(0, 3)] = v;
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const out = {} as OperatingHours;
  let any = false;
  for (const d of days) {
    const v = norm[d];
    if (v && v.open && v.close) {
      out[d] = `${v.open} - ${v.close}`;
      any = true;
    } else out[d] = null;
  }
  return any ? out : null;
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
    photos: (raw.photos ?? []).map((p) => p.gcsPath),
    videoCount: 0,
    businessHours: null,
    operatingHours: toOperatingHours(raw.businessHours),
  };
}

export const gymService = {
  // ── Gyms ──────────────────────────────────────────────────────────────────

  search: (params: { keyword?: string; lat?: number; lng?: number; radiusKm?: number; page?: number; size?: number }) =>
    api.get<PageResponse<RawGymSummary>>("/gyms", { params }).then((res) => ({
      ...res,
      data: { ...res.data, content: res.data.content.map(toGym) },
    })) as Promise<{ data: PageResponse<Gym> }>,

  getNearby: (params: { lat: number; lng: number; radius?: number; size?: number }) =>
    api.get<RawGymSummary[]>("/gyms/nearby", { params }).then((res) => ({ ...res, data: res.data.map(toGym) })) as Promise<{ data: Gym[] }>,

  getGym: (id: string) => api.get<RawGymDetail>(`/gyms/${id}`).then((res) => ({ ...res, data: toGymDetail(res.data) })) as Promise<{ data: GymDetail }>,

  getGymVideos: (gymId: string, params?: { page?: number; size?: number; sort?: string }) =>
    api.get<PageResponse<Omit<RawRecommendedVideo, "source">>>(`/gyms/${gymId}/videos`, { params }).then((res) => ({
      ...res,
      data: { ...res.data, content: res.data.content.map(toGymVideo) },
    })) as Promise<{ data: PageResponse<FeedVideo> }>,

  // ── Grades (영상 등록용 활성 난이도) ────────────────────────────────────────

  getGrades: (gymId: string) => api.get<GymGrade[]>(`/gyms/${gymId}/grades`),

  // ── Photos ─────────────────────────────────────────────────────────────────

  getPhotos: (gymId: string) => api.get<RawGymPhoto[]>(`/gyms/${gymId}/photos`).then((res) => ({ ...res, data: res.data.map(toGymPhoto) })) as Promise<{ data: GymPhoto[] }>,

  // ── Reviews ────────────────────────────────────────────────────────────────

  getReviews: async (gymId: string, params?: { page?: number; size?: number }): Promise<{ data: PageResponse<GymReview> }> => {
    const { data } = await api.get<PageResponse<RawGymReview>>(`/gyms/${gymId}/reviews`, { params });
    const userMap = await resolveUsers(data.content.map((r) => r.userId));
    return {
      data: {
        ...data,
        content: data.content.map((r) => ({
          id: String(r.id),
          gymId: String(r.gymId),
          user: userMap.get(String(r.userId)) ?? { id: String(r.userId), nickname: "사용자", profileImageUrl: null },
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
    const user = await resolveUser(String(r.userId));
    return {
      data: {
        id: String(r.id),
        gymId: String(r.gymId),
        user,
        rating: r.rating,
        content: r.content,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    };
  },

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
