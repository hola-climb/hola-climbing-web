import axios from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";

// 모든 요청과 토큰 재발급이 같은 베이스를 쓰도록 단일 상수로 관리.
// 항상 "/api" 를 사용한다 — dev 는 Vite 프록시, 프로덕션은 동일 출처 리버스 프록시가
// "/api" 를 백엔드로 넘겨준다. (백엔드 호스트를 직접 가리키면 LAN/CORS 로 깨질 수 있어
//  VITE_API_BASE_URL 직접 지정은 사용하지 않는다.)
const API_BASE = "/api";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Unwrap ApiResponse<T> wrapper → res.data becomes the inner data field.
// Backend wraps responses as { isSuccess, code, message, data, timestamp }.
api.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data === "object" && ("isSuccess" in res.data || "success" in res.data) && "data" in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
  (error) => Promise.reject(error),
);

// 인증이 불필요한(오히려 토큰을 붙이면 안 되는) 엔드포인트.
// 로그인/회원가입/토큰재발급에 stale 토큰을 붙이면 로그인 자체가 401로 실패할 수 있다.
const AUTH_ENDPOINTS = ["/auth/login", "/auth/signup", "/auth/refresh"];
function isAuthEndpoint(url?: string) {
  return !!url && AUTH_ENDPOINTS.some((p) => url.includes(p));
}

// Attach access token to every request (auth 엔드포인트 제외)
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("access_token");
  if (token && config.headers && !isAuthEndpoint(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

// Handle 401 — attempt token refresh once, then logout
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // 로그인/회원가입/재발급의 401은 그대로 호출자에게 전달 (refresh 재시도 금지).
    // 그렇지 않으면 비밀번호 오류(U003) 같은 로그인 실패가 refresh 로직에 삼켜진다.
    if (error.response?.status !== 401 || original._retry || isAuthEndpoint(original?.url)) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        })
        .catch((e) => Promise.reject(e));
    }

    // No refresh token = user is not logged in; just reject silently so
    // individual pages can handle it (e.g. show empty state, not crash).
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      return Promise.reject(error);
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // Use raw axios to avoid infinite loop; unwrap ApiResponse<T> manually.
      // 반드시 api 인스턴스와 동일한 API_BASE를 사용해야 만료 시 정상 재발급된다.
      const { data: resData } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
      const tokenData = resData?.data ?? resData; // handle ApiResponse<T> wrapper
      const newToken: string = tokenData.accessToken;
      const newRefresh: string = tokenData.refreshToken;

      localStorage.setItem("access_token", newToken);
      localStorage.setItem("refresh_token", newRefresh);

      original.headers.Authorization = `Bearer ${newToken}`;
      processQueue(null, newToken);

      return api(original);
    } catch (err) {
      processQueue(err, null);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      // Use dynamic import to avoid circular deps; router guard handles the redirect.
      import("@/router").then(({ default: router }) => {
        const current = router.currentRoute.value.fullPath;
        router.push({ path: "/auth/login", query: { redirect: current } });
      });
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
