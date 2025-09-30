import axios from "axios";

// Create a base Axios instance pointing to Django backend via Vite proxy - KR 18/08/2025
const apiBase =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL.replace(/\/+$/, "") // strip trailing slashes
    : "/api"; // dev fallback

const api = axios.create({ baseURL: apiBase });

// --- Public endpoints (no Authorization header required) - KR 02/09/2025
const PUBLIC_PREFIXES = [
  "/movies/now_playing/",
  "/movies/streaming_trending/",
  "/movies/search/",
  "/movies/trending/",
  "/movies/by_person/",
  "/movies/providers/",
  "/poster_palette/",
];

function stripApiPrefix(u = "") {
  // normalize leading "/api" once, whether full or not
  return u.startsWith("/api") ? u.slice(4) || "/" : u;
}

function isPublicPath(url = "") {
  if (!url) return false;
  const path = stripApiPrefix(url);
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (/^\/movies\/\d+\/?$/.test(path)) return true; 
  return false;
}

// Utility: identify endpoints that it should never try to refresh for - KR 29/08/2025
const isTokenEndpoint = (url = "") =>
  url.includes("/api/token/") || url.includes("/token/");

// Utility: dev/HMR/static requests to ignore - KR 29/08/2025
const isHmrOrStatic = (url = "") =>
  url.startsWith("/@") ||
  url.includes("@react-refresh") ||
  url.includes("vite") ||
  url.endsWith(".map") ||
  url.endsWith(".ico");

// --- Request interceptor ---
// Attach access token to every request IF it's protected - KR 02/09/2025
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  const url = config?.url || "";
  if (token && !isPublicPath(url) && !isTokenEndpoint(url)) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// prevents multiple refresh requests - KR 21/08/2025
let isRefreshing = false;
let pendingQueue = [];

// single-shot redirect guard to avoid loops - KR 29/08/2025
let didRedirectToLogin = false;

// Utility: process queued requests after refresh completes - KR 21/08/2025
const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject, original }) => {
    if (error) {
      reject(error);
    } else {
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${token}`;
      resolve(api(original));
    }
  });
  pendingQueue = [];
};

// --- Response interceptor ---
// Handles refresh token flow safely - KR 21/08/2025
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;

    // Normalize URL: Axios keeps baseURL and url separate - KR 02/09/2025
    const base = typeof original.baseURL === "string" ? original.baseURL : "";
    const path = typeof original.url === "string" ? original.url : "";
    const fullUrl = `${base || ""}${path || ""}`;

    // If this isn't an API call or is dev HMR/static, fail fast - KR 29/08/2025
    if (!fullUrl.includes("/api/") || isHmrOrStatic(fullUrl)) {
      return Promise.reject(error);
    }

    // Never refresh or redirect for PUBLIC endpoints - KR 02/09/2025
    if (isPublicPath(fullUrl)) {
      return Promise.reject(error);
    }

    // Only attempt refresh for 401s from protected API that aren't token endpoints - KR 29/08/2025
    if (status === 401 && !original._retry && !isTokenEndpoint(fullUrl)) {
      original._retry = true;

      // If a refresh is already in progress, queue this request - KR 21/08/2025
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject, original });
        });
      }

      const refresh = localStorage.getItem("refresh");
      if (!refresh) {
        // No refresh token -> hard sign out - KR 20/08/2025
        if (!didRedirectToLogin && !location.pathname.startsWith("/login")) {
          didRedirectToLogin = true;
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      isRefreshing = true;
      try {
        // request a new access token from Django using the refresh token - KR 19/08/2025
        const { data } = await axios.post(`${apiBase}/token/refresh/`, { refresh });

        // save and use the new access token - KR 20/08/2025
        localStorage.setItem("access", data.access);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.access}`;

        // process the queue with the new token - KR 20/08/2025
        processQueue(null, data.access);

        // retry the original request - KR 20/08/2025
        return api(original);
      } catch (e) {
        // refresh failed -> sign out to avoid loops - KR 20/08/2025
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        processQueue(e, null);
        if (!didRedirectToLogin && !location.pathname.startsWith("/login")) {
          didRedirectToLogin = true;
          window.location.href = "/login";
        }
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

if (typeof window !== "undefined" && import.meta.env.PROD) {
  console.log("[API BASE]", apiBase);
}

export default api;