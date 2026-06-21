import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import type { AnalysisStatus, FeedVideo, UpdateVideoPayload, Video } from '@/types/api'
import { parseTechniqueTags } from '@/types/api'
import { videoService } from '@/services/video'
import { useUIStore } from '@/stores/ui'

interface AnalysisProgress {
  progress: number
  stage: string
  message: string
}

export const useVideoStore = defineStore('video', () => {
  // state
  const feedVideos = ref<FeedVideo[]>([])
  const feedPage = ref(0)
  const feedHasNext = ref(true)
  const isLoadingFeed = ref(false)

  const currentVideo = ref<Video | null>(null)
  const isUploading = ref(false)
  const uploadProgress = ref(0)

  // 분석 진행 상태 — videoId별. 워처가 store에 살아 네비게이션과 독립적으로 추적.
  const analysisProgressById = reactive<Record<string, AnalysisProgress>>({})
  // 진행 중 워처 추적(비반응) — 중복 방지 + 명시적 중단용
  const activeWatchers = new Set<string>()
  const controllers = new Map<string, AbortController>()

  function getAnalysisProgress(videoId: string): AnalysisProgress {
    return analysisProgressById[videoId] ?? { progress: 0, stage: '', message: '' }
  }

  // actions
  async function loadFeed(reset = false) {
    if (isLoadingFeed.value) return
    if (!reset && !feedHasNext.value) return

    if (reset) {
      feedPage.value = 0
      feedVideos.value = []
      feedHasNext.value = true
    }

    isLoadingFeed.value = true
    try {
      const { data } = await videoService.getFeed({
        page: feedPage.value,
        size: 10,
      })
      feedVideos.value.push(...data.content)
      feedPage.value++
      feedHasNext.value = data.hasNext
    } finally {
      isLoadingFeed.value = false
    }
  }

  async function fetchVideo(id: string) {
    const { data } = await videoService.getVideo(id)
    currentVideo.value = data
    return data
  }

  async function uploadVideo(payload: {
    file: File
    gymId: number
    gymGradeId: number
    recordedDate: string          // YYYY-MM-DD
    isPublic?: boolean
    title?: string
    description?: string
    durationSeconds?: number
    thumbnailFile?: File | null
  }): Promise<Video> {
    isUploading.value = true
    uploadProgress.value = 0
    try {
      // Step 1: Get signed upload URL
      const { data: urlData } = await videoService.getUploadUrl({
        fileName: payload.file.name,
        fileSize: payload.file.size,
        mimeType: payload.file.type,
      })

      // Step 2: Upload directly to GCS
      await videoService.uploadToGcs(urlData.uploadUrl, payload.file, (pct) => {
        uploadProgress.value = pct
      })

      // Step 2.5: Upload thumbnail if user selected a frame
      let thumbnailPath: string | undefined
      if (payload.thumbnailFile) {
        const { data: thumbData } = await videoService.uploadThumbnail(payload.thumbnailFile)
        thumbnailPath = thumbData.thumbnailPath
      }

      // Step 3: Register video in backend (status=pending → AI analysis queued)
      const { data: video } = await videoService.registerVideo({
        objectPath: urlData.objectPath,
        recordedDate: payload.recordedDate,
        gymId: payload.gymId,
        gymGradeId: payload.gymGradeId,
        title: payload.title,
        description: payload.description,
        durationSeconds: payload.durationSeconds,
        thumbnailPath,
        isPublic: payload.isPublic ?? true,
      })
      return video
    } finally {
      isUploading.value = false
    }
  }

  async function updateVideo(id: string, payload: UpdateVideoPayload): Promise<void> {
    const { data: updated } = await videoService.updateVideo(id, payload)
    if (currentVideo.value?.id === id) {
      currentVideo.value = { ...currentVideo.value, ...updated }
    }
    const idx = feedVideos.value.findIndex((v) => v.id === id)
    if (idx !== -1 && updated.title !== undefined) {
      feedVideos.value[idx] = { ...feedVideos.value[idx], title: updated.title }
    }
  }

  async function deleteVideo(id: string) {
    await videoService.deleteVideo(id)
    feedVideos.value = feedVideos.value.filter((v) => v.id !== id)
    if (currentVideo.value?.id === id) currentVideo.value = null
  }

  /**
   * 분석 워처 — store에 살아 네비게이션과 독립적으로 진행률을 추적한다.
   * 멱등: 같은 videoId를 이미 watch 중이면 no-op (재진입 시 중복 스트림 방지).
   * 분석은 서버에서 진행되므로 화면을 나가도 워처가 살아 완료 시 토스트로 알린다.
   */
  async function watchAnalysis(videoId: string): Promise<void> {
    if (activeWatchers.has(videoId)) return
    activeWatchers.add(videoId)
    analysisProgressById[videoId] = { progress: 0, stage: '', message: '' }

    const controller = new AbortController()
    controllers.set(videoId, controller)
    const ui = useUIStore()

    try {
      const finalStatus = await videoService.streamAnalysis(
        videoId,
        (status, progress, stage, message) => {
          const entry = analysisProgressById[videoId]
          if (entry) {
            entry.progress = progress
            if (stage) entry.stage = stage
            if (message) entry.message = message
          }
          if (currentVideo.value?.id === videoId) {
            currentVideo.value.status = status
            currentVideo.value.progress = progress
          }
        },
        controller,
      )

      if (finalStatus === 'done') {
        try {
          const { data: analysis } = await videoService.getAnalysis(videoId)
          // Set status and analysis together so the UI transitions directly from
          // loader → result card without an intermediate blank state
          if (currentVideo.value?.id === videoId) {
            currentVideo.value.analysis = analysis
            currentVideo.value.status = 'done'
            currentVideo.value.progress = 100
          }
        } catch {
          // getAnalysis failed — still mark done so the page isn't stuck on loader
          if (currentVideo.value?.id === videoId) {
            currentVideo.value.status = 'done'
            currentVideo.value.progress = 100
          }
        }
        ui.showToast('AI 분석이 완료됐어요!')
      } else if (finalStatus === 'failed') {
        if (currentVideo.value?.id === videoId) currentVideo.value.status = 'failed'
        ui.showToast('AI 분석에 실패했어요.', 'danger')
      }
    } catch {
      // 스트림 오류(중단 제외) — 조용히 종료. status는 analyzing 유지, 재진입 시 재시도 가능.
    } finally {
      activeWatchers.delete(videoId)
      controllers.delete(videoId)
      delete analysisProgressById[videoId]
    }
  }

  /** 명시적 스트림 중단(로그아웃 등 정리용). 일반 네비게이션에선 호출하지 않는다. */
  function stopAnalysis(videoId: string) {
    controllers.get(videoId)?.abort()
    controllers.delete(videoId)
    activeWatchers.delete(videoId)
  }

  async function retryAnalysis(videoId: string) {
    stopAnalysis(videoId)
    await videoService.retryAnalysis(videoId)
    if (currentVideo.value?.id === videoId) {
      currentVideo.value.status = 'analyzing'
      currentVideo.value.progress = 0
    }
  }

  async function submitFeedback(
    videoId: string,
    payload: { isDynamic: boolean; techniques: string[] },
    verdicts?: Record<string, 'correct' | 'incorrect'>,
    added?: string[],
  ) {
    await videoService.submitFeedback(videoId, payload)
    if (currentVideo.value?.id === videoId && currentVideo.value.analysis) {
      const tags = currentVideo.value.analysis.techniques
      // 기존 감지 기술의 유저 verdict 반영
      if (verdicts) {
        for (const [key, verdict] of Object.entries(verdicts)) {
          const tag = tags.find((t) => t.key === key)
          if (tag) tag.userFeedback = verdict
        }
      }
      // 사용자가 추가한 기술 — 결과 카드에 즉시 반영
      if (added) {
        for (const key of added) {
          if (!tags.some((t) => t.key === key)) {
            tags.push({ key, confidence: 1, userFeedback: 'correct' })
          }
        }
      }
    }
  }

  async function toggleLike(videoId: string) {
    // Feed cards (recommendations) don't carry like state; operate on the
    // currently open video detail when it matches.
    const video = currentVideo.value?.id === videoId ? currentVideo.value : null
    const wasLiked = video?.isLiked ?? false
    try {
      const { data } = wasLiked
        ? await videoService.unlikeVideo(videoId)
        : await videoService.likeVideo(videoId)
      if (video) {
        video.isLiked = data.isLiked
        video.likeCount = data.likeCount
      }
    } catch {
      // Optimistic update rollback not needed; re-throw
      throw new Error('like_failed')
    }
  }

  return {
    feedVideos,
    feedHasNext,
    isLoadingFeed,
    currentVideo,
    isUploading,
    uploadProgress,
    getAnalysisProgress,
    loadFeed,
    fetchVideo,
    uploadVideo,
    updateVideo,
    deleteVideo,
    watchAnalysis,
    stopAnalysis,
    retryAnalysis,
    submitFeedback,
    toggleLike,
  }
})
