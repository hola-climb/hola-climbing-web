import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AnalysisStatus, FeedVideo, Video } from '@/types/api'
import { parseTechniqueTags } from '@/types/api'
import { videoService } from '@/services/video'

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 20

export const useVideoStore = defineStore('video', () => {
  // state
  const feedVideos = ref<FeedVideo[]>([])
  const feedPage = ref(0)
  const feedHasNext = ref(true)
  const isLoadingFeed = ref(false)

  const currentVideo = ref<Video | null>(null)
  const isUploading = ref(false)
  const uploadProgress = ref(0)

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

      // Step 3: Register video in backend (status=pending → AI analysis queued)
      const { data: video } = await videoService.registerVideo({
        objectPath: urlData.objectPath,
        recordedDate: payload.recordedDate,
        gymId: payload.gymId,
        gymGradeId: payload.gymGradeId,
        title: payload.title,
        description: payload.description,
        durationSeconds: payload.durationSeconds,
        isPublic: payload.isPublic ?? true,
      })
      return video
    } finally {
      isUploading.value = false
    }
  }

  async function deleteVideo(id: string) {
    await videoService.deleteVideo(id)
    feedVideos.value = feedVideos.value.filter((v) => v.id !== id)
    if (currentVideo.value?.id === id) currentVideo.value = null
  }

  async function pollAnalysis(videoId: string): Promise<AnalysisStatus> {
    let attempts = 0
    return new Promise((resolve, reject) => {
      const poll = async () => {
        attempts++
        try {
          const { data } = await videoService.getVideoStatus(videoId)
          // Update current video progress if it's the same video
          if (currentVideo.value?.id === videoId) {
            currentVideo.value.status = data.status
            currentVideo.value.progress = data.progress
          }

          if (data.status === 'done') {
            // Fetch full analysis on completion
            try {
              const { data: analysis } = await videoService.getAnalysis(videoId)
              if (currentVideo.value?.id === videoId) {
                currentVideo.value.analysis = analysis
              }
            } catch {
              // Analysis fetch is best-effort
            }
            resolve('done')
            return
          }

          if (data.status === 'failed') {
            resolve('failed')
            return
          }

          if (attempts >= POLL_MAX_ATTEMPTS) {
            resolve('failed')
            return
          }
          setTimeout(poll, POLL_INTERVAL_MS)
        } catch (e) {
          reject(e)
        }
      }
      poll()
    })
  }

  async function retryAnalysis(videoId: string) {
    await videoService.retryAnalysis(videoId)
    if (currentVideo.value?.id === videoId) {
      currentVideo.value.status = 'analyzing'
      currentVideo.value.progress = 0
    }
  }

  async function submitFeedback(videoId: string, techniqueKey: string, isCorrect: boolean) {
    await videoService.submitFeedback(videoId, { techniqueLabel: techniqueKey, isCorrect })
    if (currentVideo.value?.id === videoId && currentVideo.value.analysis) {
      const tag = currentVideo.value.analysis.techniques.find((t) => t.key === techniqueKey)
      if (tag) tag.userFeedback = isCorrect ? 'correct' : 'incorrect'
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
    loadFeed,
    fetchVideo,
    uploadVideo,
    deleteVideo,
    pollAnalysis,
    retryAnalysis,
    submitFeedback,
    toggleLike,
  }
})
