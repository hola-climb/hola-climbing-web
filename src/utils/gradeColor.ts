// Gym grade label → display (hold) color.
// Labels are gym-defined color names (예: "빨강", "파랑"). We render the chip/
// placeholder in the actual hold color. Add new labels here as they appear.

const HOLD_COLORS: Record<string, string> = {
  흰색: '#F5F5F5', 하양: '#F5F5F5', 화이트: '#F5F5F5',
  노랑: '#FFD400', 노란색: '#FFD400', 옐로우: '#FFD400',
  주황: '#FF9800', 주황색: '#FF9800', 오렌지: '#FF9800',
  초록: '#3CB371', 초록색: '#3CB371', 녹색: '#3CB371', 그린: '#3CB371',
  연두: '#C8FF00', 연두색: '#C8FF00',
  파랑: '#2D7FF9', 파란색: '#2D7FF9', 블루: '#2D7FF9',
  하늘: '#56CCF2', 하늘색: '#56CCF2',
  남색: '#1B3A8C',
  빨강: '#FF4D4D', 빨간색: '#FF4D4D', 레드: '#FF4D4D',
  보라: '#9B5DE5', 보라색: '#9B5DE5', 퍼플: '#9B5DE5',
  분홍: '#FF6FA5', 핑크: '#FF6FA5',
  회색: '#8D96A8', 회색색: '#8D96A8', 그레이: '#8D96A8',
  검정: '#151515', 검은색: '#151515', 블랙: '#151515',
  갈색: '#8B5A2B', 브라운: '#8B5A2B',
}

// V-scale numeric fallback (when label is "V5" etc.)
function vTone(n: number): string {
  if (n <= 2) return '#C8FF00'
  if (n <= 4) return '#FF4D94'
  if (n === 5) return '#FF9800'
  return '#22D3EE'
}

/** Resolve a grade label (color name or V-scale) to a display color. */
export function gradeColor(label: string | null | undefined): string {
  if (!label) return 'var(--surface-soft)'
  const key = label.trim()
  if (HOLD_COLORS[key]) return HOLD_COLORS[key]
  const m = key.match(/\d+/)
  if (m) return vTone(Number(m[0]))
  return 'var(--surface-soft)'
}

// Difficulty rank for color-name grades (낮을수록 쉬움).
// 색상 난이도는 암장마다 다르나, 국내 클라이밍장에서 통용되는 일반 순서를 기본값으로 둔다.
const DIFFICULTY_RANK: Record<string, number> = {
  흰색: 1, 하양: 1, 화이트: 1,
  노랑: 2, 노란색: 2, 옐로우: 2,
  주황: 3, 주황색: 3, 오렌지: 3,
  초록: 4, 초록색: 4, 녹색: 4, 그린: 4,
  연두: 5, 연두색: 5,
  파랑: 6, 파란색: 6, 블루: 6,
  하늘: 7, 하늘색: 7,
  남색: 8,
  빨강: 9, 빨간색: 9, 레드: 9,
  분홍: 10, 핑크: 10,
  보라: 11, 보라색: 11, 퍼플: 11,
  갈색: 12, 브라운: 12,
  회색: 13, 회색색: 13, 그레이: 13,
  검정: 14, 검은색: 14, 블랙: 14,
}

/** Resolve a grade label to a numeric difficulty for sorting (낮을수록 쉬움).
 *  Color names use a conventional rank; V-scale uses its number (offset so V0 > colors). */
export function gradeDifficulty(label: string | null | undefined): number {
  if (!label) return -1
  const key = label.trim()
  if (DIFFICULTY_RANK[key] != null) return DIFFICULTY_RANK[key]
  const m = key.match(/\d+/)
  if (m) return 100 + Number(m[0])
  return -1
}

/** Readable text color (dark/light) for a given hex background. */
export function gradeTextColor(bg: string): string {
  const hex = bg.startsWith('#') ? bg.slice(1) : ''
  if (hex.length !== 6) return '#151515'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // perceived luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#151515' : '#FFFFFF'
}
