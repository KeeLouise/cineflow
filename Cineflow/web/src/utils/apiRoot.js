const raw =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : "/api";

const API_ROOT = String(raw).replace(/\/+$/, "");
export default API_ROOT;