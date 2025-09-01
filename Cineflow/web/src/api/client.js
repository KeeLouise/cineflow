import axios from 'axios'

// Create a base Axios instance pointing to Django backend via Vite proxy - KR 18/08/2025
const api = axios.create({ baseURL: '/api' });

// Attach access token to every request if it exists in localStorage - KR 18/08/2025
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// prevents multiple refresh requests - KR 21/08/2025
let isRefreshing = false;
let pendingQueue = [];

// single-shot redirect guard to avoid loops - KR 29/08/2025
let didRedirectToLogin = false;

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject, original }) => {
    if (error) {
      reject(error);
    } else {
      original.headers.Authorization = `Bearer ${token}`;
      resolve(api(original));
    }
  });
  pendingQueue = [];
};

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

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;

    // Guards
    const isApi = typeof original.url === "string" && original.url.startsWith("/api/");
    const isDev = !!import.meta?.env?.DEV;
    const isHmr =
      typeof original.url === "string" &&
      (original.url.startsWith("/@") ||
       original.url.includes("@react-refresh") ||
       original.url.includes("vite/client"));

    // Only try refresh if it's an API call and 401
    if (status === 401 && isApi && !original._retry) {
      original._retry = true;
    }

    // Avoid redirect loops during dev
    if (isDev || !isApi || isHmr) {
      return Promise.reject(error);
    }

    if (status === 401) {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;