import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import api from "./client";
import { HolaSse } from "./sseClient";
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
    user: { nickname: raw.nickname ?? '사용자', profileImage: raw.profileImage ?? null },
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

interface RawComment {
  id: number;
  videoId: number;
  userId: number;
  nickname?: string | null;
  profileImage?: string | null;
  parentId: number | null;
  content: string;
  createdAt: string;
}

function toComment(raw: RawComment): Comment {
  return {
    id: String(raw.id),
    videoId: String(raw.videoId),
    parentId: raw.parentId != null ? String(raw.parentId) : null,
    user: { id: String(raw.userId), nickname: raw.nickname ?? "사용자", profileImage: raw.profileImage ?? null },
    content: raw.content,
    createdAt: raw.createdAt,
    updatedAt: null,
  };
}

// ── SSE (분석 진행률 스트리밍) ──────────────────────────────────────────────────

type OnProgress = (status: AnalysisStatus, progress: number, stage: string, message: string) => void;

interface SseProgressPayload {
  videoId: number;
  status: AnalysisStatus;
  progress: number;
  stage: string;
  message: string;
  updatedAt: string;
}

/**
 * 분석 스트림 URL. 네이티브는 절대경로(VITE_API_BASE_URL, `.../api/` 로 끝남),
 * 웹은 dev 프록시/직결되는 상대경로 `/api`.
 */
function analysisStreamUrl(videoId: string): string {
  return Capacitor.isNativePlatform()
    ? `${import.meta.env.VITE_API_BASE_URL}videos/${videoId}/analysis/stream`
    : `/api/videos/${videoId}/analysis/stream`;
}

/** SSE 프레임에서 event/data 라인 추출 (웹·네이티브 공용). */
function parseSseFrame(msg: string): { event: string; dataLine: string } {
  let event = "";
  let dataLine = "";
  for (const line of msg.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
  }
  return { event, dataLine };
}

/**
 * 완성된 SSE 프레임 1개 처리. terminal(done/failed)이면 해당 status 반환,
 * 진행 이벤트면 onProgress 호출 후 null 반환. (웹·네이티브 공용)
 */
function handleSseFrame(msg: string, onProgress: OnProgress): AnalysisStatus | null {
  const { event, dataLine } = parseSseFrame(msg);
  if (event !== "progress" || !dataLine) return null;
  try {
    const payload = JSON.parse(dataLine) as SseProgressPayload;
    if (payload.status === "done" || payload.status === "failed") return payload.status;
    onProgress(payload.status, payload.progress ?? 0, payload.stage ?? "", payload.message ?? "");
  } catch {
    // malformed SSE line — skip
  }
  return null;
}

/** 웹: fetch + ReadableStream 으로 SSE 직접 읽기. */
function streamAnalysisWeb(url: string, token: string | null, onProgress: OnProgress, externalController?: AbortController): Promise<AnalysisStatus> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // store가 워처 정리/중단을 위해 controller를 주입할 수 있다. 없으면 자체 생성.
    const controller = externalController ?? new AbortController();

    fetch(url, { headers, signal: controller.signal })
      .then((res) => {
        if (!res.ok || !res.body) {
          reject(new Error(`SSE error: ${res.status}`));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
                const terminal = handleSseFrame(msg, onProgress);
                if (terminal) {
                  controller.abort();
                  resolve(terminal);
                  return;
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
}

/** 네이티브(iOS): HolaSse 플러그인이 URLSession 으로 스트리밍하고 프레임을 이벤트로 전달. */
function streamAnalysisNative(url: string, token: string | null, onProgress: OnProgress, externalController?: AbortController): Promise<AnalysisStatus> {
  return new Promise((resolve, reject) => {
    let streamId: string | null = null;
    let settled = false;
    const handles: PluginListenerHandle[] = [];

    const cleanup = async () => {
      for (const h of handles) {
        try {
          await h.remove();
        } catch {
          /* ignore */
        }
      }
      if (streamId) {
        try {
          await HolaSse.disconnect({ id: streamId });
        } catch {
          /* ignore */
        }
      }
    };

    const finish = (status: AnalysisStatus) => {
      if (settled) return;
      settled = true;
      void cleanup();
      resolve(status);
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      void cleanup();
      // 명시적 중단은 웹 경로의 AbortError 와 동일하게 처리되도록 전달.
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    externalController?.signal.addEventListener("abort", () => {
      fail(new DOMException("Aborted", "AbortError"));
    });

    void (async () => {
      try {
        handles.push(
          await HolaSse.addListener("sseMessage", (e) => {
            if (e.id !== streamId || !e.data) return;
            const terminal = handleSseFrame(e.data, onProgress);
            if (terminal) finish(terminal);
          }),
          // 서버가 terminal 이벤트 없이 닫으면 done 으로 간주(웹 reader done 과 동일).
          await HolaSse.addListener("sseClose", (e) => {
            if (e.id === streamId) finish("done");
          }),
          await HolaSse.addListener("sseError", (e) => {
            if (e.id === streamId) fail(new Error(e.message ?? "sse_error"));
          }),
        );

        if (externalController?.signal.aborted) {
          void cleanup();
          return;
        }

        const { id } = await HolaSse.connect({ url, token: token ?? undefined });
        streamId = id;
      } catch (err) {
        fail(err);
      }
    })();
  });
}

// ── Feed / Listing ────────────────────────────────────────────────────────────

export const videoService = {
  getFeed: (params: { cursor?: string | null; size?: number }) =>
    api.get<PageResponse<RawRecommendedVideo>>("/recommendations/videos", { params: { ...(params.cursor ? { cursor: params.cursor } : {}), size: params.size } }).then((res) => ({
      ...res,
      data: { ...res.data, content: res.data.content.map(toFeedVideo) },
    })) as Promise<{ data: PageResponse<FeedVideo> }>,

  getPublicVideos: async (cursor?: string | null, size = 20): Promise<{ content: FeedVideo[]; nextCursor: string | null; hasNext: boolean }> => {
    const params: Record<string, unknown> = { size };
    if (cursor) params.cursor = cursor;
    const { data } = await api.get<{ content: RawRecommendedVideo[]; nextCursor: string | null; hasNext: boolean }>("/videos", { params });
    return {
      content: data.content.map((raw) => toFeedVideo({ ...raw, source: "feed" })),
      nextCursor: data.nextCursor,
      hasNext: data.hasNext,
    };
  },

  getVideo: async (id: string): Promise<{ data: Video }> => {
    const { data: raw } = await api.get<RawVideoDetail>(`/videos/${id}`);

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
  streamAnalysis: (videoId: string, onProgress: OnProgress, externalController?: AbortController): Promise<AnalysisStatus> => {
    const url = analysisStreamUrl(videoId);
    const token = localStorage.getItem("access_token");
    // iOS WKWebView 는 fetch SSE 스트림을 버퍼링해 동작하지 않으므로 네이티브 플러그인 사용.
    return Capacitor.isNativePlatform()
      ? streamAnalysisNative(url, token, onProgress, externalController)
      : streamAnalysisWeb(url, token, onProgress, externalController);
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
    return {
      data: {
        ...data,
        content: data.content.map((raw) => ({
          id: String(raw.id),
          user: {
            id: userId,
            nickname: raw.nickname ?? "사용자",
            profileImage: raw.profileImage ?? null,
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
    return { data: { ...data, content: data.content.map(toComment) } };
  },

  addComment: async (videoId: string, content: string, parentId?: string): Promise<{ data: Comment }> => {
    const { data: raw } = await api.post<RawComment>(`/videos/${videoId}/comments`, { content, parentId: parentId ?? null });
    return { data: toComment(raw) };
  },

  updateComment: (commentId: string, content: string) => api.patch<Comment>(`/comments/${commentId}`, { content }),

  deleteComment: (commentId: string) => api.delete(`/comments/${commentId}`),

  // 공유
  getShareUrl: (videoId: string) => api.get<{ shareUrl: string }>(`/videos/${videoId}/share`),

  // ── Reports ───────────────────────────────────────────────────────────────

  report: (targetType: ReportTargetType, targetId: string, category: ReportCategory, reason?: string) =>
    api.post("/reports", { targetType, targetId: Number(targetId), category, reason }),
};
