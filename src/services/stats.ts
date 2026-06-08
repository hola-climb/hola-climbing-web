import api from './client'
import type {
  CalendarDay, CalendarDayRecord, CalendarMonthItem,
  PublicUserStats, TechniqueStats, UserStats,
} from '@/types/api'

/** Map raw calendar month item to the UI CalendarDay shape */
function toCalendarDay(item: CalendarMonthItem): CalendarDay {
  return {
    date: item.date,
    hasRecord: item.logCount > 0,
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
    api.get<CalendarMonthItem[]>('/stats/me/calendar', { params: { year, month } })
      .then((res) => ({
        ...res,
        data: res.data.map(toCalendarDay),
      })) as Promise<{ data: CalendarDay[] }>,

  /** 월간 달력 (원본 카운트 포함) — GET /api/stats/me/calendar?year=&month= */
  getCalendarRaw: (year: number, month: number) =>
    api.get<CalendarMonthItem[]>('/stats/me/calendar', { params: { year, month } }),

  /** 일별 기록 — GET /api/stats/me/calendar/{date} */
  getCalendarDay: (date: string) =>
    api.get<CalendarDayRecord[]>(`/stats/me/calendar/${date}`),

  /** 특정 사용자 통계 — GET /api/stats/users/{userId} */
  getUserStats: (userId: string) =>
    api.get<PublicUserStats>(`/stats/users/${userId}`),
}
