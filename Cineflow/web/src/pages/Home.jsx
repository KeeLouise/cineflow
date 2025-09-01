// Home.jsx - Main landing page for Cineflow - KR 21/08/2025
import { Link } from "react-router-dom";
import React, { useEffect, useRef, useState } from "react";
import {
  fetchNowPlaying,
  fetchStreamingTrending,
  searchMovies,
  searchByPerson,
} from "../api/movies"; // calls Django proxy - KR 21/08/2025
import SearchBar from "@/components/SearchBar.jsx"; // hero search - KR 25/08/2025
import SkeletonRow from "@/components/SkeletonRow.jsx"; // shimmer loaders - KR 25/08/2025
import "@/styles/home.css";

// util: format 'YYYY-MM-DD' -> 'DD/MM/YYYY' - KR 25/08/2025
const formatDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// small debounce helper for the search box - KR 25/08/2025
function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Allowed providers using TMDB IDs - KR 28/08/2025
const PROVIDER_OPTIONS = [
  { id: 8,   label: "Netflix" },
  { id: 337, label: "Disney+" },
  { id: 531, label: "Paramount+" },
  { id: 9,   label: "Prime Video" },
];

export default function Home() {
  // Local state for each section - KR 21/08/2025
  const [cinema, setCinema] = useState([]);
  const [streaming, setStreaming] = useState([]);

  // Search state (suggestions + results) - KR 25/08/2025
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounced = useDebounced(query, 450); // results rail debounce - KR 25/08/2025

  // Loading + error - KR 21/08/2025
  const [loadingCinema, setLoadingCinema] = useState(true);
  const [loadingStreaming, setLoadingStreaming] = useState(true);
  const [err, setErr] = useState("");

  // Region defaults (make user-selectable later) - KR 21/08/2025
  const REGION = "GB";

  // Provider filter (chips) - KR 28/08/2025
  const [selectedProviders, setSelectedProviders] = useState([]); // [] = all

  // Monetization types toggle (chip) - KR 28/08/2025
  const [includeRentBuy, setIncludeRentBuy] = useState(true); // default ON for broader results

  // Paging for streaming rail - KR 28/08/2025
  const [streamingPage, setStreamingPage] = useState(1);
  const [streamingHasMore, setStreamingHasMore] = useState(true);
  const [fallbackNote, setFallbackNote] = useState(""); // UI hint when few results - KR 28/08/2025

  // Paging for cinemas rail - KR 29/08/2025
  const [cinemaPage, setCinemaPage] = useState(1);
  const [cinemaHasMore, setCinemaHasMore] = useState(true);

  // refs for horizontal reels - KR 25/08/2025
  const cinemaRef = useRef(null);
  const streamingRef = useRef(null);
  const searchRef = useRef(null);

  // Infinite-scroll sentinels - KR 29/08/2025
  const cinemaSentinelRef = useRef(null);
  const streamingSentinelRef = useRef(null);

  // remember last query sent to backend to avoid re-fetching identical text - KR 25/08/2025
  const lastQueryRef = useRef("");

  // helper for rail scroll buttons - KR 25/08/2025
  const scrollReel = (ref, dir = 1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector(".poster-card");
    const step = card ? Math.round(card.getBoundingClientRect().width * 3) : 600;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  // Fetch "What's on in Cinemas" on mount - KR 21/08/2025
  useEffect(() => {
    (async () => {
      try {
        setLoadingCinema(true);
        const np = await fetchNowPlaying(REGION, 1);
        const list = np.results || [];
        setCinema(list);
        setCinemaPage(1);
        setCinemaHasMore((np.page || 1) < (np.total_pages || 1)); // there are more pages? - KR 29/08/2025
      } catch (e) {
        console.error("Now playing load failed:", e);
        setErr("Could not load content. Please try again.");
      } finally {
        setLoadingCinema(false);
      }
    })();
  }, []); // mount only - KR 21/08/2025

  // Refetch streaming when provider filter / monetization changes - KR 28/08/2025
  useEffect(() => {
    (async () => {
      try {
        setLoadingStreaming(true);

        const providersParam = selectedProviders.length
          ? selectedProviders.join("|")
          : "";

        // strict if any providers selected; else allow ads/free - KR 29/08/2025
        const baseTypes = selectedProviders.length ? "flatrate" : "flatrate,ads,free";
        const types = includeRentBuy ? `${baseTypes},rent,buy` : baseTypes;

        const st = await fetchStreamingTrending({
          region: REGION,
          providers: providersParam,
          types,
          page: 1,
        });

        const list = st.results || [];
        setStreaming(list);
        setStreamingPage(1); // reset paging
        setStreamingHasMore((st.page || 1) < (st.total_pages || 1)); // there are more pages? - KR 29/08/2025
        setFallbackNote(
          list.length < 10 && (providersParam || includeRentBuy)
            ? "Limited results for this selection. Try adding providers or toggling rent/buy."
            : ""
        );
      } catch (e) {
        console.error("Streaming fetch failed:", e);
        setStreaming([]);
        setStreamingHasMore(false);
        setFallbackNote("No streaming results for this selection.");
      } finally {
        setLoadingStreaming(false);
      }
    })();
  }, [selectedProviders, includeRentBuy]); // KR 28/08/2025

  // Load more streaming (infinite scroll) - KR 29/08/2025
  const loadMoreStreaming = async () => {
    if (!streamingHasMore || loadingStreaming) return;
    try {
      setLoadingStreaming(true);

      const providersParam = selectedProviders.length
        ? selectedProviders.join("|")
        : "";

      const baseTypes = selectedProviders.length ? "flatrate" : "flatrate,ads,free";
      const types = includeRentBuy ? `${baseTypes},rent,buy` : baseTypes;

      const nextPage = streamingPage + 1;
      const st = await fetchStreamingTrending({
        region: REGION,
        providers: providersParam,
        types,
        page: nextPage,
      });

      const more = st.results || [];
      // Dedupe on append - KR 29/08/2025
      const seen = new Set(streaming.map((m) => m.id));
      const merged = [...streaming, ...more.filter((m) => m?.id && !seen.has(m.id))];

      setStreaming(merged);
      setStreamingPage(nextPage);
      setStreamingHasMore((st.page || nextPage) < (st.total_pages || nextPage));
    } catch (e) {
      console.error("Load more streaming failed:", e);
      setStreamingHasMore(false);
    } finally {
      setLoadingStreaming(false);
    }
  };

  // Load more cinemas (infinite scroll) - KR 29/08/2025
  const loadMoreCinema = async () => {
    if (!cinemaHasMore || loadingCinema) return;
    try {
      setLoadingCinema(true);
      const nextPage = cinemaPage + 1;
      const np = await fetchNowPlaying(REGION, nextPage);
      const more = np.results || [];

      // Dedupe on append - KR 29/08/2025
      const seen = new Set(cinema.map((m) => m.id));
      const merged = [...cinema, ...more.filter((m) => m?.id && !seen.has(m.id))];

      setCinema(merged);
      setCinemaPage(nextPage);
      setCinemaHasMore((np.page || nextPage) < (np.total_pages || nextPage));
    } catch (e) {
      console.error("Load more cinemas failed:", e);
      setCinemaHasMore(false);
    } finally {
      setLoadingCinema(false);
    }
  };

 // IntersectionObserver for Streaming inside horizontal scroller - KR 01/09/2025
useEffect(() => {
  if (!streamingHasMore) return;
  const rootEl = streamingRef.current;
  const target = streamingSentinelRef.current;
  if (!rootEl || !target) return;

  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) loadMoreStreaming();
    },
    {
      root: rootEl,                 
      rootMargin: "0px 800px 0px 0px", // prefetch ~800px before right edge - KR 01/09/2025
      threshold: 0,
    }
  );

  io.observe(target);
  return () => io.disconnect();
}, [streamingHasMore, loadMoreStreaming]);

  // IntersectionObserver for cinema sentinel - KR 29/08/2025
  useEffect(() => {
    if (!cinemaHasMore) return;
    const rootEl = cinemaRef.current;
    const target = cinemaSentinelRef.current;
    if (!rootEl || !target) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreCinema();
      },
      {
        root:rootEl,
        rootMargin: "0px 800px 0px 0px",
        threshold: 0,
      }
    );

    io.observe(target);
    return () => io.disconnect();
  }, [cinemaHasMore, loadMoreCinema]);

  // Full results rail + suggestions when user pauses typing (single source of truth) - KR 25/08/2025
  useEffect(() => {
    let active = true;
    const q = debounced?.trim();

    // if input too short, clear state - KR 25/08/2025
    if (!q || q.length < 2) {
      setResults([]);
      setSuggestions([]);
      setSearching(false);
      lastQueryRef.current = "";
      return;
    }

    // skip if query hasn't actually changed (prevents dup calls on same text) - KR 25/08/2025
    if (lastQueryRef.current === q) return;
    lastQueryRef.current = q;

    const controller = new AbortController();

    (async () => {
      setSearching(true);
      try {
        // titles + person credits together - KR 25/08/2025
        const [byTitle, byPerson] = await Promise.all([
          searchMovies(q, { signal: controller.signal }),
          searchByPerson(q, { signal: controller.signal }),
        ]);

        const merged = [...(byTitle.results || []), ...(byPerson.results || [])];

        // Dedupe by TMDB id - KR 25/08/2025
        const seen = new Set();
        const uniq = merged.filter((m) => {
          if (!m?.id) return false;
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });

        if (!active) return;

        // update both rails + suggestions from the same payload - KR 25/08/2025
        setResults(uniq);
        setSuggestions(uniq.slice(0, 8).map((m) => ({ id: m.id, label: m.title })));
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("Search failed:", e);
          if (active) {
            setResults([]);
            setSuggestions([]);
          }
        }
      } finally {
        if (active) setSearching(false);
      }
    })();

    // cleanup cancels in-flight request on fast typing / unmount - KR 25/08/2025
    return () => {
      active = false;
      controller.abort();
    };
  }, [debounced]);

  // Provider filter UI (chips) - KR 28/08/2025
  const toggleProvider = (id) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const clearProviders = () => setSelectedProviders([]);

  // helper to render one poster card (used by all rails) - KR 25/08/2025
  const PosterCard = ({ m }) => (
    <article className="poster-card">
      <Link to={`/movie/${m.id}`} className="text-decoration-none">
        <div className="poster-media">
          {m.poster_path ? (
            <img
              className="poster-img"
              src={`https://image.tmdb.org/t/p/w500${m.poster_path}`}
              alt={m.title}
              loading="lazy"
            />
          ) : (
            <div className="poster-fallback d-flex align-items-center justify-content-center text-muted">
              No Image
            </div>
          )}

          {/* rating pill (TMDB out of 10) - KR 25/08/2025 */}
          {m.vote_average ? (
            <span className="badge-rating">{m.vote_average.toFixed(1)}</span>
          ) : null}

          {/* dark gradient overlay for legibility - KR 25/08/2025 */}
          <div className="poster-overlay" />
        </div>

        <div className="poster-meta">
          <div className="title" title={m.title}>{m.title}</div>
          <div className="sub text-muted">
            {/* year chip + formatted date - KR 25/08/2025 */}
            <span className="chip-year">
              {(m.release_date || "").slice(0, 4) || "—"}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );

  return (
    <div className="home-page">
      <div className="container-fluid py-5">
        {/* Hero search wrapper - KR 25/08/2025 */}
        <section className="hero-search mb-5">
          <div className="container text-center">
            <h1 className="display-5 mb-3">Welcome to Cineflow</h1>
            <p className="lead mb-4">Search for your favourite films</p>

            {/* SearchBar with suggestions (type-ahead) - single source of truth (no onSearch) - KR 25/08/2025 */}
            <div className="searchbar-wrapper mx-auto">
              <SearchBar
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  // allow same text to re-trigger if user edits and returns - KR 25/08/2025
                  if (v.trim() !== lastQueryRef.current) {
                    // let the debounced effect decide when to fetch
                  }
                }}
                isLoading={searching}
                suggestions={suggestions}
                onSelectSuggestion={(s) => {
                  // replace text with chosen suggestion - KR 25/08/2025
                  setQuery(s.label);
                  // debounced effect will run; if identical text, lastQueryRef prevents refetch - KR 25/08/2025
                }}
              />
            </div>
          </div>
        </section>

        {err && <div className="alert alert-danger">{err}</div>}

        {/* If user is searching, show search rail first - KR 25/08/2025 */}
        {query.trim().length >= 2 && (
          <>
            <div className="section-head mb-3 d-flex align-items-center justify-content-between">
              <h2 className="mb-3">🔎 Results for “{debounced}”</h2>
            </div>
            {searching ? (
              <SkeletonRow count={8} />
            ) : results.length ? (
              <div className="reel-wrap mb-5">
                <button
                  type="button"
                  className="reel-btn left"
                  aria-label="Scroll search left"
                  onClick={() => scrollReel(searchRef, -1)}
                >
                  ‹
                </button>

                <div ref={searchRef} className="h-scroll">
                  {results.map((m) => (
                    <PosterCard key={`s-${m.id}`} m={m} />
                  ))}
                </div>

                <button
                  type="button"
                  className="reel-btn right"
                  aria-label="Scroll search right"
                  onClick={() => scrollReel(searchRef, 1)}
                >
                  ›
                </button>
              </div>
            ) : (
              <div className="text-muted mb-4">No results found.</div>
            )}
          </>
        )}

        {/* What's on in Cinemas - KR 21/08/2025 */}
        <div className="section-head mb-3 d-flex align-items-center justify-content-between">
          <h2 className="m-0">🎟️ What’s on in Cinemas</h2>
          <a className="link-ghost" href="#" aria-label="View all now playing">View all</a>
        </div>
        <div className="reel-wrap mb-3">
          <button
            type="button"
            className="reel-btn left"
            aria-label="Scroll cinemas left"
            onClick={() => scrollReel(cinemaRef, -1)}
          >
            ‹
          </button>

          <div ref={cinemaRef} className="h-scroll">
            {loadingCinema && cinema.length === 0 ? (
              <SkeletonRow count={8} />
            ) : cinema.length ? (
              cinema.map((m) => <PosterCard key={`c-${m.id}`} m={m} />)
            ) : (
              <div className="text-muted p-2">No cinema listings.</div>
            )}

          {/* Infinite scroll sentinel for cinemas - KR 29/08/2025 */}
        <div ref={cinemaSentinelRef} className="infinite-sentinel" aria-hidden="true" style={{ height: 1 }} />
          </div>

          <button
            type="button"
            className="reel-btn right"
            aria-label="Scroll cinemas right"
            onClick={() => scrollReel(cinemaRef, 1)}
          >
            ›
          </button>
        </div>
        

        {/* Trending on Streaming + provider filter - KR 28/08/2025 */}
        <div className="section-head mb-2 d-flex align-items-center justify-content-between">
          <h2 className="m-0">📺 Trending on Streaming</h2>
          <a className="link-ghost" href="#" aria-label="View all streaming">View all</a>
        </div>

        {/* Provider filter chips - KR 28/08/2025 */}
        <div className="provider-filter mb-3 d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <div className="pf-row">
            {PROVIDER_OPTIONS.map((p) => {
              const active = selectedProviders.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`pf-chip ${active ? "active" : ""}`}
                  onClick={() => toggleProvider(p.id)}
                  aria-pressed={active}
                >
                  {p.label}
                </button>
              );
            })}
            <button
              type="button"
              className={`pf-chip clear ${selectedProviders.length === 0 ? "active" : ""}`}
              onClick={clearProviders}
              aria-pressed={selectedProviders.length === 0}
              title="Show all providers"
            >
              All
            </button>
          </div>

          {/* Monetization chip to widen results - KR 28/08/2025 */}
          <button
            type="button"
            className={`pf-chip ${includeRentBuy ? "active" : ""}`}
            onClick={() => setIncludeRentBuy((v) => !v)}
            aria-pressed={includeRentBuy}
            title="Include rent/buy options to widen results"
          >
            Rent/Buy
          </button>
        </div>

        {fallbackNote && (
          <div className="alert alert-warning py-2 px-3 mb-3" role="status">
            {fallbackNote}
          </div>
        )}

        <div className="reel-wrap">
          <button
            type="button"
            className="reel-btn left"
            aria-label="Scroll streaming left"
            onClick={() => scrollReel(streamingRef, -1)}
          >
            ‹
          </button>

          <div ref={streamingRef} className="h-scroll">
            {loadingStreaming && streaming.length === 0 ? (
              <SkeletonRow count={8} />
            ) : streaming.length ? (
              streaming.map((m) => <PosterCard key={`t-${m.id}`} m={m} />)
            ) : (
              <div className="text-muted p-2">No streaming results.</div>
            )}

            {/* Infinite scroll for streaming - KR 29/08/2025 */}
        <div ref={streamingSentinelRef} className="infinite-sentinel" aria-hidden="true" style={{ height: 1 }} />

          </div>

          <button
            type="button"
            className="reel-btn right"
            aria-label="Scroll streaming right"
            onClick={() => scrollReel(streamingRef, 1)}
          >
            ›
          </button>
        </div>
        
      </div>
    </div>
  );
}