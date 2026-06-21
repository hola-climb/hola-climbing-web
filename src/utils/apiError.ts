// 백엔드 에러 응답에서 사용자 노출용 메시지/코드를 안전하게 꺼내는 헬퍼.
// 백엔드는 모든 응답을 { isSuccess, code, message, data, timestamp } 로 감싼다.
// 성공 응답은 client.ts 인터셉터가 data 필드로 언랩하지만, 에러 응답은
// 언랩하지 않으므로 error.response.data 에 wrapper 가 그대로 들어있다.

interface ApiErrorBody {
  code?: string;
  message?: string;
}

function getErrorBody(err: unknown): ApiErrorBody | undefined {
  return (err as { response?: { data?: ApiErrorBody } })?.response?.data;
}

/**
 * 백엔드가 내려준 message 를 그대로 반환한다.
 * 네트워크 오류 등으로 message 가 없으면 fallback 을 쓴다.
 *
 * 기본은 항상 이 함수로 백엔드 메시지를 노출하고,
 * 텍스트 외 동작(버튼/리다이렉트/필드 강조 등)이 필요한 경우에만
 * getErrorCode 로 분기한다.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  return getErrorBody(err)?.message ?? fallback;
}

/** 특정 에러 코드로 분기가 필요할 때만 사용한다 (예: U004 → 인증 메일 재발송). */
export function getErrorCode(err: unknown): string | undefined {
  return getErrorBody(err)?.code;
}
