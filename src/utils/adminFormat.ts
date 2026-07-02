// 어드민 목록/상세용 경량 날짜 포매터. 별도 date 라이브러리 없이 로컬 포맷.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-07-01 14:30" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-07-01" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 0.9167 → "91.7%" */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * 백엔드 businessHours 요일 키(`MONDAY`, `Monday`, `mon` 등 케이싱이 섞여 올 수 있음)를
 * `mon`..`sun` 소문자 3글자로 정규화한다. services/gym.ts 의 toBusinessHours 와 동일한 규칙.
 */
export function normalizeBusinessHours<T>(bh: Record<string, T> | null | undefined): Record<string, T> {
  if (!bh) return {};
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(bh)) {
    out[k.toLowerCase().slice(0, 3)] = v;
  }
  return out;
}
