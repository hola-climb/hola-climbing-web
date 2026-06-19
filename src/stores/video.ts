import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AnalysisStatus, FeedVideo, UpdateVideoPayload, Video } from '@/types/api'
import { parseTechniqueTags } from '@/types/api'
import { videoService } from '@/services/video'


export const useVideoStore = defineStore('video', () => {
  // state
  const feedVideos = ref<FeedVideo[]>([])
  const feedPage = ref(0)
  const feedHasNext = ref(true)
  const isLoadingFeed = ref(false)

  const currentVideo = ref<Video | null>(null)
  const isUploading = ref(false)
  const uploadProgress = ref(0)
  const analysisProgressMessage = ref("")
  const analysisStage = ref("")
  const analysisProgress = ref(0)

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

  async function pollAnalysis(videoId: string): Promise<AnalysisStatus> {
    analysisProgressMessage.value = ""
    analysisStage.value = ""
    analysisProgress.value = 0
    const finalStatus = await videoService.streamAnalysis(videoId, (status, progress, stage, message) => {
      if (currentVideo.value?.id === videoId) {
        currentVideo.value.status = status
        currentVideo.value.progress = progress
      }
      analysisProgress.value = progress
      if (stage) analysisStage.value = stage
      if (message) analysisProgressMessage.value = message
    })

    if (finalStatus === 'done') {
      try {
        const { data: analysis } = await videoService.getAnalysis(videoId)
        // Set status and analysis together so the UI transitions directly from
        // "analyzing" spinner → result card without an intermediate blank state
        if (currentVideo.value?.id === videoId) {
          currentVideo.value.analysis = analysis
          currentVideo.value.status = 'done'
          currentVideo.value.progress = 100
        }
      } catch {
        // getAnalysis failed — still mark done so the page isn't stuck on spinner
        if (currentVideo.value?.id === videoId) {
          currentVideo.value.status = 'done'
          currentVideo.value.progress = 100
        }
      }
    } else if (finalStatus === 'failed') {
      if (currentVideo.value?.id === videoId) {
        currentVideo.value.status = 'failed'
      }
    }

    return finalStatus
  }

  async function retryAnalysis(videoId: string) {
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
  ) {
    await videoService.submitFeedback(videoId, payload)
    if (verdicts && currentVideo.value?.id === videoId && currentVideo.value.analysis) {
      for (const [key, verdict] of Object.entries(verdicts)) {
        const tag = currentVideo.value.analysis.techniques.find((t) => t.key === key)
        if (tag) tag.userFeedback = verdict
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
    analysisProgressMessage,
    analysisStage,
    analysisProgress,
    loadFeed,
    fetchVideo,
    uploadVideo,
    updateVideo,
    deleteVideo,
    pollAnalysis,
    retryAnalysis,
    submitFeedback,
    toggleLike,
  }
})
