export function mediaUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin =
    import.meta.env.VITE_BACKEND_ORIGIN || "http://127.0.0.1:8000";
  return `${origin}${path}`;
}