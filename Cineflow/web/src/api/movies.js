import api from "./client"; // axios instance with baseURL: '/api'

// --- Helpers --- KR 28/08/2025
export function buildProvidersParam(ids) {
  // TMDB expects pipe-separated provider IDs, e.g. "8|337"
  return Array.isArray(ids) && ids.length ? ids.join("|") : "";
}

// --- Movie API wrappers (Django backend proxies TMDB) --- KR 21/08/2025

// Fetch trending movies of the week (from Django backend). - KR 21/08/2025
export async function fetchTrendingMovies({ signal } = {}) {
  const { data } = await api.get("/movies/trending/", { signal });
  return data; // JSON forwarded from TMDB
}

// Search movies by title (from Django backend). - KR 21/08/2025
export async function searchMovies(q, { signal } = {}) {
  const { data } = await api.get("/movies/search/", {
    params: { q },
    signal,
  });
  return data;
}

// Search by person/actor -> movie credits (via Django backend). - KR 25/08/2025
export async function searchByPerson(q, { signal } = {}) {
  const { data } = await api.get("/movies/by_person/", {
    params: { q },
    signal,
  });
  return data;
}

// Fetch what's currently playing in cinemas. - KR 21/08/2025
export async function fetchNowPlaying(region = "GB", page = 1, { signal } = {}) {
  const { data } = await api.get("/movies/now_playing/", {
    params: { region, page },
    signal,
  });
  return data;
}

// Trending on streaming - KR 21/08/2025
export async function fetchStreamingTrending(
  {
    region = "GB",
    providers = "",
    types = "flatrate,ads,free",
    page = 1,
    debug = false,  
    broad = false,  
  },
  { signal } = {}
) {
  const params = {
    region,
    ...(providers ? { providers } : {}),
    types,
    page,
    ...(debug ? { debug: 1 } : {}),
    ...(broad ? { broad: 1 } : {}),
  };

  const { data } = await api.get("/movies/streaming_trending/", { params, signal });

  if (import.meta?.env?.DEV) {
    
    console.log("[DISCOVER DEBUG] sent-to-server:", params);
  
    console.log("[DISCOVER DEBUG] results:", (data?.results || []).length);
  }

  return data;
}

// Fetch a single movie detail (+credits,+videos,+providers). - KR 26/08/2025
export async function fetchMovieDetail(id, region = "GB", { signal } = {}) {
  const { data } = await api.get(`/movies/${id}/`, {
    params: { region },
    signal,
  });
  return data;
}

// Mood-based discover (requires auth) - KR 02/09/2025
export async function fetchMoodDiscover(
  {
    mood,
    region = "GB",
    providers = "",
    types = "flatrate,ads,free",
    page = 1,
    debug = false,
    broad = false,
    fast = false,
    // NEW filters — KR 10/09/2025
    decade = "",          // "2020s", "2010s", ...
    tmdbMin = "",         // number/string -> vote_average.gte
    cfMin = "",           // number/string -> cineflow score minimum
  } = {},
  { signal } = {}
) {
  if (!mood) throw new Error("mood is required");

  const params = {
  region,
  page,
  types, // e.g. "flatrate,ads,free" (MUST be commas)

  // Provider constraints
  ...(providers ? { providers, broad: 1 } : {}), // widen monetization when provider selected

  // Filters — use names the backend actually parses
  ...(decade ? { decade } : {}),
  ...(tmdbMin !== "" && tmdbMin != null ? { vote_average_gte: Number(tmdbMin) } : {}),

  // If "cfMin" was meant to control mood strictness, map it properly:
  ...(cfMin ? { mood_strength: cfMin } : {}), // expect 'strict' | 'balanced' | 'loose'

  // Flags
  ...(debug ? { debug: 1 } : {}),
  ...(fast ? { fast: 1 } : {}),
};

  const { data } = await api.get(`/movies/mood/${mood}/`, { params, signal });
  return data;
}