import api from "./client";

// Helpers - KR 28/08/2025
export function buildProvidersParam(ids) {
  return Array.isArray(ids) && ids.length ? ids.join("|") : "";
}

export async function fetchProviders(region = "GB", { signal } = {}) {
  const tryPath = async (path) => {
    const res = await api.get(path, { params: { region }, signal, responseType: "text" });
    const text = typeof res.data === "string" ? res.data : JSON.stringify(res.data || {});
    const looksHTML = /^\s*<(?:!DOCTYPE|html)/i.test(text);
    if (looksHTML) {
      throw new Error(`Non-JSON response at ${path}`);
    }

    const data = typeof res.data === "string" ? JSON.parse(text) : res.data;

    const results = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];
    return { results };
  };

  try {
    return await tryPath("/movies/providers/");
  } catch {
    return await tryPath("/movie/providers/");
  }
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

  const raw = Array.isArray(data) ? data : (data?.results ?? []);
  const results = raw.map((m) => ({
    id: Number(m?.id ?? m?.tmdb_id ?? 0),
    title: m?.title ?? m?.name ?? "",
    poster_path: m?.poster_path ?? "",
    release_date: m?.release_date ?? m?.first_air_date ?? "",
  }));
  return { results };
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

    tmdbMin = "",
    vote_average_gte,
    cfMin,
    force_providers,
  } = {},
  { signal } = {}
) {
  if (!mood) throw new Error("mood is required");

  const rating =
    vote_average_gte != null
      ? Number(vote_average_gte)
      : tmdbMin !== "" && tmdbMin != null
      ? Number(tmdbMin)
      : undefined;

  const params = {
    region,
    page,
    types,
    ...(providers ? { providers, broad: 1 } : {}),
    ...(rating != null && !Number.isNaN(rating) ? { vote_average_gte: rating } : {}),
    ...(debug ? { debug: 1 } : {}),
    ...(fast ? { fast: 1 } : {}),
    ...(force_providers ? { force_providers: 1 } : {}),
  };

  const { data } = await api.get(`/movies/mood/${mood}/`, { params, signal });
  return data;
}

