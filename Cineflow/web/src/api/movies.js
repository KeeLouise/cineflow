const API_KEY = import.meta.env.VITE_TMDB_API_KEY;  // pulled from .env at build time - KR 21/08/2025
const BASE_URL = "https://api.themoviedb.org/3";

export async function fetchTrendingMovies() {
  const res = await fetch("/api/movies/trending/");
  if (!res.ok) throw new Error(`Backend error ${res.status}`);
  return res.json();
}

export async function searchMovies(q) {
  const res = await fetch(`/api/movies/search/?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Backend error ${res.status}`);
  return res.json();
}