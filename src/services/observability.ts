import { initializeFaro, getWebInstrumentations, type Faro } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

let faro: Faro | undefined;

// ─────────────────────────────────────────────────────────────
// 마스킹 규칙 — 올라 서비스 전용. 모든 텔레메트리는 외부(Grafana Cloud)로
// 나가기 직전 beforeSend 에서 아래 규칙으로 정제된다.
//   1) 토큰: Authorization/Bearer, access_token, refresh_token, JWT
//   2) AI 분석 결과: "업로더 본인에게만" 규칙 → 외부 전송 금지
//   3) 개인정보: email, 전화번호
// ─────────────────────────────────────────────────────────────

// 값을 통째로 [REDACTED] 처리할 객체 키 (부분일치, 대소문자 무시)
const SENSITIVE_KEYS = [
  "authorization",
  "access_token",
  "refresh_token",
  "accesstoken",
  "refreshtoken",
  "token",
  "password",
  "email",
  "phone",
  // AI 분석 결과 관련 필드 — docs/api_spec.md 응답 필드명에 맞춰 보정할 것
  "analysis",
  "airesult",
  "ai_result",
  "feedback",
  "techtags",
];

// 문자열 본문에서 치환할 패턴
const STRING_RULES: Array<[RegExp, string]> = [
  // Authorization 헤더 / Bearer 토큰
  [/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]"],
  // JWT (eyJ... 형태)
  [/eyJ[A-Za-z0-9._-]{10,}/g, "[JWT_REDACTED]"],
  // 이메일
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]"],
  // 한국 휴대폰 번호 (010-1234-5678, 01012345678 등)
  [/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, "[PHONE_REDACTED]"],
];

function redactString(input: string): string {
  let out = input;
  for (const [re, rep] of STRING_RULES) out = out.replace(re, rep);
  return out;
}

// 객체/배열을 깊게 순회: 민감 키는 통째로, 문자열 값은 패턴 치환
function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return value; // 과도한 재귀 방지
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = redactDeep(v, depth + 1);
      }
    }
    return result;
  }
  return value;
}

/** Faro 초기화. 프로덕션 + URL이 설정된 경우에만 동작 (dev 로그 규칙 준수). */
export function initObservability() {
  if (!import.meta.env.PROD || !import.meta.env.VITE_FARO_URL) return;

  faro = initializeFaro({
    url: import.meta.env.VITE_FARO_URL,
    app: {
      name: "hola-climbing",
      version: import.meta.env.VITE_APP_VERSION ?? "0.0.0",
      environment: import.meta.env.MODE,
    },
    instrumentations: [
      ...getWebInstrumentations(), // 에러 + Web Vitals(LCP/CLS/INP…) 자동 수집
      new TracingInstrumentation(), // API 트레이싱(OpenTelemetry)
    ],
    // 전송 직전 마스킹 — 토큰/AI결과/개인정보 외부 유출 차단 (이중 안전망)
    beforeSend: (item) => {
      try {
        return redactDeep(item) as typeof item;
      } catch {
        return item; // 마스킹 실패 시에도 파이프라인 유지
      }
    },
  });
}

/** 로그인 시 유저 컨텍스트. PII 금지 — 식별자(id)만 전달. */
export function setObservabilityUser(userId?: string) {
  faro?.api.setUser(userId ? { id: userId } : undefined);
}

/** 수동 에러 보고 (예: API 인터셉터). */
export function reportError(err: unknown, context?: Record<string, string>) {
  if (!faro) return;
  faro.api.pushError(err instanceof Error ? err : new Error(String(err)), { context });
}
