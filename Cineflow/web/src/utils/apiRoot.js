const API_ROOT =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
    : "/api";

export default API_ROOT;