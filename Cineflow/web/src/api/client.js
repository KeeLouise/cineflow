import axios from "axios";

const raw =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE)) ||
  "/api";

export const API_BASE = String(raw).replace(/\/+$/, "");

const api = axios.create({ baseURL: API_BASE });

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
  return u.startsWith("/api") ? u.slice(4) || "/" : u;
}
function isPublicPath(url = "") {
  if (!url) return false;
  const path = stripApiPrefix(url);
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (/^\/movies\/\d+\/?$/.test(path)) return true;
  return false;
}
const isTokenEndpoint = (url = "") => url.includes("/token/");

const isHmrOrStatic = (url = "") =>
  url.startsWith("/@") ||
  url.includes("@react-refresh") ||
  url.includes("vite") ||
  url.endsWith(".map") ||
  url.endsWith(".ico");

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  const url = config?.url || "";
  if (token && !isPublicPath(url) && !isTokenEndpoint(url)) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let queue = [];
let didRedirectToLogin = false;

const flushQueue = (error, token = null) => {
  queue.forEach(({ resolve, reject, original }) => {
    if (error) reject(error);
    else {
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${token}`;
      resolve(api(original));
    }
  });
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;

    const base = typeof original.baseURL === "string" ? original.baseURL : "";
    const path = typeof original.url === "string" ? original.url : "";
    const fullUrl = `${base || ""}${path || ""}`;

    if (!fullUrl.includes("/api/") || isHmrOrStatic(fullUrl)) {
      return Promise.reject(error);
    }
    if (isPublicPath(fullUrl)) {
      return Promise.reject(error);
    }

    if (status === 401 && !original._retry && !isTokenEndpoint(fullUrl)) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject, original });
        });
      }

      const refresh = localStorage.getItem("refresh");
      if (!refresh) {
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
        const { data } = await axios.post(`${API_BASE}/token/refresh/`, { refresh });
        localStorage.setItem("access", data.access);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.access}`;

        flushQueue(null, data.access);
        return api(original);
      } catch (e) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        flushQueue(e, null);
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

if (typeof window !== "undefined" && import.meta.env?.PROD) {
  console.log("[API BASE]", API_BASE);
}

export default api;