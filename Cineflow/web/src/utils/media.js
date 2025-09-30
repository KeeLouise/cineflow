export function mediaUrl(path) {
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) return path;

  // normalize relative paths
  let normalized = path.startsWith("/") ? path : `/${path}`;
  if (!normalized.startsWith("/media/")) {
    normalized = `/media${normalized}`;
  }

  if (!import.meta.env.PROD) return normalized;

  const apiBase =
    (import.meta.env && import.meta.env.VITE_API_URL)
      ? import.meta.env.VITE_API_URL.replace(/\/+$/, "")
      : "";

  return `${apiBase}${normalized}?v=${Date.now()}`;
}