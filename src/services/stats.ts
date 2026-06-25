import api from './client'
import type {
  CalendarDay, CalendarDayRecord, CalendarMonth, CalendarMonthItem,
  PublicUserStats, TechniqueStats, UserStats,
  MonthlyReport, GymRanking,
} from '@/types/api'

/** Map raw calendar month item to the UI CalendarDay shape.
 *  영상(videoCount) 또는 기록(logCount)이 있으면 기록이 있는 날로 본다. */
function toCalendarDay(item: CalendarMonthItem): CalendarDay {
  return {
    date: item.date,
    hasRecord: item.videoCount > 0 || item.logCount > 0,
    gymName: null,
  }
}

export const statsService = {
  /** 내 통계 — GET /api/stats/me */
  getStats: () =>
    api.get<UserStats>('/stats/me'),

  /** 기술별 통계 — GET /api/stats/me/techniques */
  getTechniques: () =>
    api.get<TechniqueStats>('/stats/me/techniques'),

  /** 월간 달력 (UI CalendarDay) — GET /api/stats/me/calendar?year=&month= */
  getCalendar: (year: number, month: number) =>
    api.get<CalendarMonth>('/stats/me/calendar', { params: { year, month } })
      .then((res) => ({
        ...res,
        data: (res.data.days ?? []).map(toCalendarDay),
      })) as Promise<{ data: CalendarDay[] }>,

  /** 월간 달력 (집계 + days 원본) — GET /api/stats/me/calendar?year=&month= */
  getCalendarRaw: (year: number, month: number) =>
    api.get<CalendarMonth>('/stats/me/calendar', { params: { year, month } }),

  /** 일별 기록 — GET /api/stats/me/calendar/{date} */
  getCalendarDay: (date: string) =>
    api.get<CalendarDayRecord[]>(`/stats/me/calendar/${date}`),

  /** 특정 사용자 통계 — GET /api/stats/users/{userId} */
  getUserStats: (userId: string) =>
    api.get<PublicUserStats>(`/stats/users/${userId}`),

  /** 월간 리포트 — GET /api/stats/me/monthly-reports?month=YYYY-MM[&gymId=]
   *  gymId 생략: 생성 없이 현재 status 조회 / gymId 포함: 생성 요청 + polling */
  getMonthlyReport: (month: string, gymId?: number) =>
    api.get<MonthlyReport>('/stats/me/monthly-reports', {
      params: gymId != null ? { month, gymId } : { month },
    }),

  /** 방문수 순 암장 랭킹(난이도 기준 선택용) — GET /api/stats/me/gyms/rankings?month=&limit= */
  getGymRankings: (month: string, limit = 10) =>
    api.get<GymRanking[]>('/stats/me/gyms/rankings', { params: { month, limit } }),
}
