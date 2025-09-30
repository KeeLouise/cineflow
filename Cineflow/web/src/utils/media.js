export function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const apiBase = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
    : "/api";
  const backendOrigin = apiBase.replace(/\/api$/, "");

  const p = path.startsWith("/") ? path : `/${path}`;
  return `${backendOrigin}${p}`;
}