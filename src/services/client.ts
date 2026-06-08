import axios from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";

// Base URL includes /api prefix matching the spec (Base: http://localhost:8080)
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";

const api: AxiosInstance = axios.create({
  // baseURL: BASE_URL,
  baseURL: "/api",
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

// Attach access token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("access_token");
  if (token && config.headers) {
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

    if (error.response?.status !== 401 || original._retry) {
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
      // Use raw axios to avoid infinite loop; unwrap ApiResponse<T> manually
      const { data: resData } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
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
