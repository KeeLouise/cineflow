const API_KEY = import.meta.env.VITE_TMDB_API_KEY;  
const BASE_URL = "https://api.themoviedb.org/3";  // Not used directly anymore

//Fetch trending movies of the week (from Django backend). - KR 21/08/2025
 
export async function fetchTrendingMovies() {
  const res = await fetch("/api/movies/trending/");
  if (!res.ok) throw new Error(`Backend error ${res.status}`);
  return res.json();  // JSON data forwarded from TMDB
}

//Search movies by title (from Django backend).

export async function searchMovies(q) {
  const res = await fetch(`/api/movies/search/?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Backend error ${res.status}`);
  return res.json();
}

// Fetch what's currently playing in cinemas. - KR 21/08/2025
 
// What's on in cinemas (region defaults to IE) - KR 21/08/2025
export async function fetchNowPlaying(region = "IE", page = 1) {
  const res = await fetch(`/api/movies/now_playing/?region=${region}&page=${page}`);
  if (!res.ok) throw new Error(`Backend error ${res.status}`);
  return res.json();
}

// NEW: Trending on streaming (optionally filter by provider IDs later) - KR 21/08/2025
export async function fetchStreamingTrending({ region = "IE", providers = "", page = 1, types = "flatrate,ads,free" } = {}) {
  const qs = new URLSearchParams({ region, page, types });
  if (providers) qs.set("providers", providers);
  const res = await fetch(`/api/movies/streaming_trending/?${qs.toString()}`);
  if (!res.ok) throw new Error(`Backend error ${res.status}`);
  return res.json();
}