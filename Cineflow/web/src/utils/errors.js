// src/utils/errors.js
export function extractErr(e) {
  const d = e?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail) return String(d.detail);
  const first = Object.values(d || {})?.[0];
  if (Array.isArray(first)) return String(first[0] || "");
  if (first) return String(first);
  return e?.message || "Something went wrong.";
}