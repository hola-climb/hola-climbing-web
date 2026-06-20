import api from "./client";
import type {
  AnalysisResult,
  AnalysisStatus,
  Comment,
  FeedVideo,
  GymGrade,
  PageResponse,
  RawRecommendedVideo,
  RegisterVideoPayload,
  ReportCategory,
  ReportTargetType,
  TechniqueTag,
  ThumbnailUploadResponse,
  UpdateVideoPayload,
  UploadUrlPayload,
  UploadUrlResponse,
  Video,
  VideoStatus,
  parseTechniqueTags,
} from "@/types/api";
import { parseTechniqueTags as parseTagsFn } from "@/types/api";

/** Map backend RecommendedVideoResponse → UI FeedVideo */
function toFeedVideo(raw: RawRecommendedVideo): FeedVideo {
  return {
    id: String(raw.id),
    userId: String(raw.userId),
    gymId: raw.gymId != null ? String(raw.gymId) : null,
    title: raw.title,
    gymName: raw.gymName,
    gymGrade: raw.gymGrade ?? null,
    grade: raw.gymGrade?.label ?? raw.grade ?? null,
    thumbnailUrl: raw.thumbnailUrl ?? raw.thumbnailPath,
    streamUrl: raw.streamUrl,
    durationSeconds: raw.durationSeconds,
    viewCount: raw.viewCount,
    likeCount: raw.likeCount,
    commentCount: raw.commentCount,
    source: raw.source,
    createdAt: raw.createdAt,
    recordedDate: raw.recordedDate ?? null,
  };
}

/** Raw GET /api/videos/{id} — backend VideoDetailResponse (no nested user/gym) */
interface RawVideoDetail {
  id: number;
  userId: number;
  nickname?: string | null; // 작성자 닉네임 (백엔드가 내려줄 때만 존재)
  profileImage?: string | null; // 작성자 프로필 이미지 signed URL
  gymId: number | null;
  title: string | null;
  description: string | null;
  grade?: string | null;
  gymName?: string | null;
  gymGrade?: GymGrade | null;
  gcsPath: string | null;
  gcsStreamingPath: string | null;
  thumbnailPath: string | null;
  thumbnailUrl?: string | null; // signed URL (백엔드가 내려줄 때만 존재)
  streamUrl: string | null;
  durationSeconds: number | null;
  status: string;
  isPublic: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Raw GET /api/videos/{id}/comments item — backend CommentResponse (no nested user) */
interface RawComment {
  id: number;
  videoId: number;
  userId: number;
  parentId: number | null;
  content: string;
  createdAt: string;
}

// Shared author-profile cache so comment lists don't refetch the same user.
const userCache = new Map<string, { id: string; nickname: string; profileImage: string | null }>();

async function resolveUser(userId: string): Promise<{ id: string; nickname: string; profileImage: string | null }> {
  if (userCache.has(userId)) return userCache.get(userId)!;
  try {
    const { data } = await api.get<{ userId?: number; id?: number; nickname: string; profileImage?: string | null; profileImageUrl?: string | null }>(`/users/${userId}`);
    const user = {
      id: String(data.id ?? data.userId ?? userId),
      nickname: data.nickname ?? "사용자",
      profileImage: data.profileImage ?? data.profileImageUrl ?? null,
    };
    userCache.set(userId, user);
    return user;
  } catch {
    return { id: userId, nickname: "사용자", profileImage: null };
  }
}

function toComment(raw: RawComment, user: { id: string; nickname: string; profileImage: string | null }): Comment {
  return {
    id: String(raw.id),
    videoId: String(raw.videoId),
    parentId: raw.parentId != null ? String(raw.parentId) : null,
    user,
    content: raw.content,
    createdAt: raw.createdAt,
    updatedAt: null,
  };
}

// ── Feed / Listing ────────────────────────────────────────────────────────────

export const videoService = {
  getFeed: (params: { page?: number; size?: number }) =>
    api.get<PageResponse<RawRecommendedVideo>>("/recommendations/videos", { params }).then((res) => ({
      ...res,
      data: { ...res.data, content: res.data.content.map(toFeedVideo) },
    })) as Promise<{ data: PageResponse<FeedVideo> }>,

  getVideo: async (id: string): Promise<{ data: Video }> => {
    const { data: raw } = await api.get<RawVideoDetail>(`/videos/${id}`);

    // Backend returns only userId/gymId — fetch author (and gym name) to build
    // the nested user/gym objects the UI expects. Best-effort, never throws.
    const [userRes, gymRes, analysisRes] = await Promise.allSettled([
      api.get<{ userId?: number; id?: number; nickname: string; profileImage?: string | null; profileImageUrl?: string | null }>(`/users/${raw.userId}`),
      raw.gymId != null ? api.get<{ id: number; name: string }>(`/gyms/${raw.gymId}`) : Promise.reject(new Error("no_gym")),
      // Analysis is owner-only on the backend; non-owners get 403 → ignored.
      raw.status === "done" ? videoService.getAnalysis(String(raw.id)) : Promise.reject(new Error("not_done")),
    ]);

    const user =
      userRes.status === "fulfilled"
        ? {
            id: String(userRes.value.data.id ?? userRes.value.data.userId ?? raw.userId),
            nickname: raw.nickname ?? userRes.value.data.nickname ?? "사용자",
            profileImage: raw.profileImage ?? userRes.value.data.profileImage ?? userRes.value.data.profileImageUrl ?? null,
          }
        : { id: String(raw.userId), nickname: raw.nickname ?? "사용자", profileImage: raw.profileImage ?? null };

    const gym = gymRes.status === "fulfilled" ? { id: String(gymRes.value.data.id), name: gymRes.value.data.name } : null;

    const analysis = analysisRes.status === "fulfilled" ? analysisRes.value.data : null;

    const video: Video = {
      id: String(raw.id),
      user,
      title: raw.title,
      gymGrade: raw.gymGrade ?? null,
      grade: raw.gymGrade?.label ?? raw.grade ?? null,
      description: raw.description,
      gym,
      gymName: raw.gymName ?? null,
      streamingUrl: raw.streamUrl ?? raw.gcsStreamingPath ?? null,
      thumbnailUrl: raw.thumbnailUrl ?? raw.thumbnailPath,
      duration: raw.durationSeconds,
      status: (raw.status as AnalysisStatus) ?? "done",
      progress: raw.status === "done" ? 100 : 0,
      isPublic: raw.isPublic,
      viewCount: raw.viewCount,
      likeCount: raw.likeCount,
      commentCount: raw.commentCount,
      isLiked: raw.isLiked,
      analysis,
      createdAt: raw.createdAt,
    };
    return { data: video };
  },

  getVideoStatus: (id: string) => api.get<VideoStatus>(`/videos/${id}/status`),

  /**
   * SSE stream for analysis progress (`GET /api/videos/{videoId}/analysis/stream`).
   * Actual payload: { videoId, status, progress, stage, message, updatedAt }
   *   status  — "analyzing" | "done" | "failed"  (lowercase, direct AnalysisStatus)
   *   stage   — "started" | "downloaded" | "pose_estimation" | "classification" | "completed"
   *   progress — 0–100 number from server
   * onProgress called for non-terminal events (status !== "done"/"failed").
   * Terminal events resolve the promise without calling onProgress so the caller
   * can set status + analysis atomically and avoid a blank-state flash.
   */
  streamAnalysis: (videoId: string, onProgress: (status: AnalysisStatus, progress: number, stage: string, message: string) => void): Promise<AnalysisStatus> => {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem("access_token");
      const headers: Record<string, string> = { Accept: "text/event-stream" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const controller = new AbortController();

      fetch(`/api/videos/${videoId}/analysis/stream`, { headers, signal: controller.signal })
        .then((res) => {
          if (!res.ok || !res.body) {
            reject(new Error(`SSE error: ${res.status}`));
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let currentEvent = "";

          const read = () => {
            reader
              .read()
              .then(({ done, value }) => {
                if (done) {
                  resolve("done");
                  return;
                }

                buffer += decoder.decode(value, { stream: true });
                const messages = buffer.split("\n\n");
                buffer = messages.pop() ?? "";

                for (const msg of messages) {
                  currentEvent = "";
                  let dataLine = "";

                  for (const line of msg.split("\n")) {
                    if (line.startsWith("event:")) currentEvent = line.slice(6).trim();
                    else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
                  }

                  if (currentEvent !== "progress" || !dataLine) continue;

                  try {
                    const payload = JSON.parse(dataLine) as {
                      videoId: number;
                      status: AnalysisStatus;
                      progress: number;
                      stage: string;
                      message: string;
                      updatedAt: string;
                    };

                    if (payload.status === "done" || payload.status === "failed") {
                      controller.abort();
                      resolve(payload.status);
                      return;
                    }

                    onProgress(payload.status, payload.progress ?? 0, payload.stage ?? "", payload.message ?? "");
                  } catch {
                    // malformed SSE line — skip
                  }
                }

                read();
              })
              .catch((err: unknown) => {
                if ((err as Error)?.name !== "AbortError") reject(err);
              });
          };

          read();
        })
        .catch((err: unknown) => {
          if ((err as Error)?.name !== "AbortError") reject(err);
        });
    });
  },

  /** 내 영상 전체 목록 — GET /api/videos?userId={id}&cursor={cursor}&size=20
   *  커서 기반 페이지네이션. cursor 없으면 첫 페이지. */
  getMyVideos: async (userId: string, cursor?: string | null, size = 20): Promise<{ content: FeedVideo[]; nextCursor: string | null; hasNext: boolean }> => {
    const params: Record<string, unknown> = { userId, size };
    if (cursor) params.cursor = cursor;
    const { data } = await api.get<{
      content: RawRecommendedVideo[];
      nextCursor: string | null;
      hasNext: boolean;
    }>("/videos", { params });
    return {
      content: data.content.map((raw) => toFeedVideo({ ...raw, source: "my" })),
      nextCursor: data.nextCursor,
      hasNext: data.hasNext,
    };
  },

  /** 날짜별 내 영상 목록 — GET /api/videos?userId={id}&recordedDate={date}
   *  커서 기반. 단일 날짜 필터로 해당 촬영일의 영상만 반환. */
  getVideosByDate: async (userId: string, recordedDate: string): Promise<FeedVideo[]> => {
    const { data } = await api.get<{
      content: RawRecommendedVideo[];
      nextCursor: string | null;
      hasNext: boolean;
    }>("/videos", { params: { userId, recordedDate, size: 50 } });
    return data.content.map((raw) => toFeedVideo({ ...raw, source: "my" }));
  },

  /** 사용자 공개 영상 목록 — GET /api/videos?userId={id}&size={size}.
   *  VideoSummaryResponse → Video (작성자 해석, 표시용 기본값 채움). */
  getUserVideos: async (userId: string, params?: { page?: number; size?: number }): Promise<{ data: PageResponse<Video> }> => {
    const { data } = await api.get<PageResponse<Omit<RawRecommendedVideo, "source">>>("/videos", {
      params: { userId, size: params?.size },
    });
    const resolved = await resolveUser(userId);
    return {
      data: {
        ...data,
        content: data.content.map((raw) => ({
          id: String(raw.id),
          // 목록 응답이 작성자 프로필을 내려주면 우선 사용, 없으면 resolveUser 결과로 보강
          user: {
            id: resolved.id,
            nickname: raw.nickname ?? resolved.nickname,
            profileImage: raw.profileImage ?? resolved.profileImage,
          },
          title: raw.title,
          gymGrade: raw.gymGrade ?? null,
          gymName: raw.gymName ?? null,
          grade: raw.gymGrade?.label ?? raw.grade ?? null,
          description: null,
          gym: null,
          streamingUrl: raw.streamUrl ?? null,
          thumbnailUrl: raw.thumbnailUrl ?? raw.thumbnailPath,
          duration: raw.durationSeconds,
          status: "done" as AnalysisStatus,
          progress: 100,
          isPublic: true,
          viewCount: raw.viewCount,
          likeCount: raw.likeCount,
          commentCount: raw.commentCount,
          isLiked: false,
          analysis: null,
          createdAt: raw.createdAt,
        })),
      },
    };
  },

  // ── Upload (2-step: signed URL → GCS PUT → register) ─────────────────────

  getUploadUrl: (payload: UploadUrlPayload) => api.post<UploadUrlResponse>("/videos/upload-url", payload),

  uploadToGcs: (uploadUrl: string, file: File, onProgress?: (pct: number) => void) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      if (onProgress) {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }
      xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`GCS upload failed: ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("GCS upload network error"));
      xhr.send(file);
    });
  },

  registerVideo: (payload: RegisterVideoPayload) => api.post<Video>("/videos", payload),

  uploadThumbnail: (imageFile: File) => {
    const form = new FormData();
    form.append("image", imageFile);
    return api.post<ThumbnailUploadResponse>("/videos/thumbnail", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  updateVideo: (id: string, payload: UpdateVideoPayload) => api.patch<Video>(`/videos/${id}`, payload),

  deleteVideo: (id: string) => api.delete(`/videos/${id}`),

  // ── Analysis ──────────────────────────────────────────────────────────────

  getAnalysis: (id: string) =>
    api.get<AnalysisResult>(`/videos/${id}/analysis`).then((res) => {
      if (res.data) {
        // Standalone analysis endpoint wraps efficiency in a nested object
        const raw = res.data as AnalysisResult & { efficiency?: { eTrajectory: number; eArm: number } };
        if (raw.efficiency) {
          res.data.eTrajectory = raw.efficiency.eTrajectory;
          res.data.eArm = raw.efficiency.eArm;
        }
        if (res.data.techniqueLabels) {
          res.data.techniques = parseTagsFn(res.data.techniqueLabels, res.data.timeline ?? []);
        } else {
          // API may return techniques as string[] — convert to TechniqueTag[]
          const rawTechs = res.data.techniques as unknown as Array<string | TechniqueTag>;
          if (Array.isArray(rawTechs) && rawTechs.length > 0 && typeof rawTechs[0] === "string") {
            res.data.techniques = (rawTechs as string[]).filter((k) => k.trim() !== "").map((key) => ({ key, confidence: 0.8, userFeedback: null }));
          } else if (!Array.isArray(rawTechs)) {
            res.data.techniques = [];
          }
        }
      }
      return res;
    }),

  retryAnalysis: (id: string) => api.post(`/videos/${id}/analysis/retry`),

  submitFeedback: (
    videoId: string,
    payload: {
      isDynamic: boolean;
      techniques: string[];
    },
  ) => api.post(`/videos/${videoId}/analysis/feedback`, payload),

  // ── Like ─────────────────────────────────────────────────────────────────

  likeVideo: (id: string) => api.post<{ isLiked: boolean; likeCount: number }>(`/videos/${id}/like`),

  unlikeVideo: (id: string) => api.delete<{ isLiked: boolean; likeCount: number }>(`/videos/${id}/like`),

  // ── Comments ──────────────────────────────────────────────────────────────

  getComments: async (videoId: string, params?: { page?: number; size?: number }): Promise<{ data: PageResponse<Comment> }> => {
    const { data } = await api.get<PageResponse<RawComment>>(`/videos/${videoId}/comments`, { params });
    // Resolve unique authors once, then map each comment.
    const uniqueIds = [...new Set(data.content.map((c) => String(c.userId)))];
    const users = await Promise.all(uniqueIds.map((id) => resolveUser(id)));
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      data: {
        ...data,
        content: data.content.map((c) => toComment(c, userMap.get(String(c.userId)) ?? { id: String(c.userId), nickname: "사용자", profileImage: null })),
      },
    };
  },

  addComment: async (videoId: string, content: string, parentId?: string): Promise<{ data: Comment }> => {
    const { data: raw } = await api.post<RawComment>(`/videos/${videoId}/comments`, { content, parentId: parentId ?? null });
    const user = await resolveUser(String(raw.userId));
    return { data: toComment(raw, user) };
  },

  updateComment: (commentId: string, content: string) => api.patch<Comment>(`/comments/${commentId}`, { content }),

  deleteComment: (commentId: string) => api.delete(`/comments/${commentId}`),

  // 공유
  getShareUrl: (videoId: string) => api.get<{ shareUrl: string }>(`/videos/${videoId}/share`),

  // ── Reports ───────────────────────────────────────────────────────────────

  report: (targetType: ReportTargetType, targetId: string, category: ReportCategory, reason?: string) =>
    api.post("/reports", { targetType, targetId: Number(targetId), category, reason }),
};
