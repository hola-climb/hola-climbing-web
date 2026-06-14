// 영상 트리밍 관련 순수 유틸 함수 (부수효과 없음 — 단위 테스트 대상)

/** 원본 파일명 → 트림 결과 파일명 (확장자 mp4 고정). 예: "clip.mov" → "clip_trimmed.mp4" */
export function makeTrimmedName(originalName: string): string {
  const base = originalName.replace(/\.[^./\\]+$/, "");
  const safeBase = base.trim() || "video";
  return `${safeBase}_trimmed.mp4`;
}

/** 선택 구간을 [0, duration] 범위로 보정하고 start < end 를 보장. */
export function clampSelection(start: number, end: number, duration: number): { start: number; end: number } {
  const dur = Math.max(0, duration);
  let s = Math.min(Math.max(0, start), dur);
  let e = Math.min(Math.max(0, end), dur);
  if (e < s) [s, e] = [e, s];
  if (e <= s) e = Math.min(s + 0.1, dur);
  return { start: s, end: e };
}

/** 초 → "M:SS" 표기. 예: 75.4 → "1:15" */
export function formatMMSS(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
