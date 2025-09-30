const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
    : "/api";

export function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/media/")) return `${API_BASE}${path}`;
  return path;
}