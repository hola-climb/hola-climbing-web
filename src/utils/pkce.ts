// PKCE (Proof Key for Code Exchange) + state 헬퍼.
// 인가코드 가로채기 방어: 프론트가 code_verifier 를 만들어 두고, authorize 에는
// 그 해시(code_challenge)만 보낸다. 교환 시 원본 verifier 를 제출해 본인 증명.
// 구글/카카오만 지원하고 네이버는 미지원이라, 네이버는 verifier 를 쓰지 않는다.

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** CSRF 방어용 state. authorize 요청과 콜백 사이 위조를 막는다. */
export function randomState(): string {
  return base64UrlEncode(randomBytes(16));
}

/** RFC 7636 권장 길이(43~128자)의 code_verifier 생성. */
export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

/** code_challenge = BASE64URL(SHA256(verifier)). S256 방식. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}
