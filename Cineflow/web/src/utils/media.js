// web/src/utils/media.js
export function mediaUrl(path) {
  if (!path) return "";

  // Absolute URL from Cloudinary
  if (/^https?:\/\//i.test(path)) return path;

  // Backend base
  const apiBase = (import.meta.env?.VITE_API_URL || "/api").replace(/\/+$/, "");
  // Origin
  const origin = apiBase.replace(/\/api$/i, "");

  // If backend already gave "/media/...", just join with origin
  if (path.startsWith("/")) return `${origin}${path}`;

  return `${origin}/media/${path}`;
}