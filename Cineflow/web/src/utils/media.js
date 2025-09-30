export function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const api = (import.meta.env?.VITE_API_URL || "/api").replace(/\/+$/, "");
  const origin = api.replace(/\/api$/i, "");

  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}