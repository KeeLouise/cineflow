import api from "./client"; // axios instance with baseURL: '/api'

// --- Helpers --- KR 28/08/2025

export function buildProvidersParam(ids) {
  return Array.isArray(ids) && ids.length ? ids.join("|") : "";
}

// --- Movie API wrappers (Django backend proxies TMDB) --- KR 21/08/2025

// Fetch trending movies of the week (from Django backend). - KR 21/08/2025
export async function fetchTrendingMovies() {
  const { data } = await api.get("/movies/trending/");
  return data; // JSON data forwarded from TMDB
}

// Search movies by title (from Django backend). - KR 21/08/2025
export async function searchMovies(q, opts = {}) {
  const { signal } = opts;
  const { data } = await api.get("/movies/search/", {
    params: { q },
    signal,
  });
  return data;
}

// Search by person/actor -> movie credits (via Django backend). - KR 25/08/2025
export async function searchByPerson(q, opts = {}) {
  const { signal } = opts;
  const { data } = await api.get("/movies/by_person/", {
    params: { q },
    signal,
  });
  return data;
}

// Fetch what's currently playing in cinemas. - KR 21/08/2025
export async function fetchNowPlaying(region = "GB", page = 1) {
  const { data } = await api.get("/movies/now_playing/", {
    params: { region, page },
  });
  return data;
}

export async function fetchStreamingTrending({
  region = "GB",
  providers = "",
  types = "flatrate,ads,free",
  page = 1,
}) {
  const params = {
    region,
    ...(providers ? { providers } : {}),
    types,
    page,
  };

  // DEV: bypass cache + get the params the server sent to TMDB
  if (import.meta.env.DEV) params.debug = 1;

  const { data } = await api.get("/movies/streaming_trending/", { params });

  if (import.meta.env.DEV && data?._debug_params) {
    console.log("[DISCOVER DEBUG] sent-to-TMDB:", data._debug_params);
    console.log("[DISCOVER DEBUG] results:", data?.results?.length ?? 0);
  }

  return data;
}

// Fetch a single movie detail (+credits,+videos,+providers). - KR 26/08/2025
export async function fetchMovieDetail(id, region = "GB") {
  const { data } = await api.get(`/movies/${id}/`, {
    params: { region },
  });
  return data;
}