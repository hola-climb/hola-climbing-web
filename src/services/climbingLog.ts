import api from './client'
import type { ClimbingLog, ClimbingLogPayload } from '@/types/api'

export const climbingLogService = {
  /** 클라이밍 기록 작성 — POST /api/climbing-logs */
  create: (payload: ClimbingLogPayload) =>
    api.post<ClimbingLog>('/climbing-logs', payload),

  /** 클라이밍 기록 단건 조회 — GET /api/climbing-logs/{logId} (작성자만) */
  get: (logId: string) =>
    api.get<ClimbingLog>(`/climbing-logs/${logId}`),

  /** 클라이밍 기록 수정 — PATCH /api/climbing-logs/{logId} (전체 치환, 작성자만) */
  update: (logId: string, payload: ClimbingLogPayload) =>
    api.patch<ClimbingLog>(`/climbing-logs/${logId}`, payload),

  /** 클라이밍 기록 삭제 — DELETE /api/climbing-logs/{logId} (소프트 삭제, 작성자만) */
  remove: (logId: string) =>
    api.delete(`/climbing-logs/${logId}`),
}
