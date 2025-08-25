// Home.jsx - Main landing page for Cineflow - KR 21/08/2025
import React, { useEffect, useRef, useState } from "react";
import {
  fetchNowPlaying,
  fetchStreamingTrending,
  searchMovies,
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

export default function Home() {
  // Local state for each section - KR 21/08/2025
  const [cinema, setCinema] = useState([]);
  const [streaming, setStreaming] = useState([]);

  // Search state (suggestions + results) - KR 25/08/2025
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const debounced = useDebounced(query, 450); // results rail debounce - KR 25/08/2025
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Loading + error - KR 21/08/2025
  const [loadingCinema, setLoadingCinema] = useState(true);
  const [loadingStreaming, setLoadingStreaming] = useState(true);
  const [err, setErr] = useState("");

  // Region defaults (make user-selectable later) - KR 21/08/2025
  const REGION = "IE";
  // Providers empty = all platforms (add picker later) - KR 21/08/2025
  const PROVIDERS = "";

  // refs for horizontal reels - KR 25/08/2025
  const cinemaRef = useRef(null);
  const streamingRef = useRef(null);
  const searchRef = useRef(null);

  // helper for rail scroll buttons - KR 25/08/2025
  const scrollReel = (ref, dir = 1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector(".poster-card");
    const step = card ? Math.round(card.getBoundingClientRect().width * 3) : 600;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  // Fetch both sections in parallel on mount - KR 21/08/2025
  useEffect(() => {
    (async () => {
      try {
        setLoadingCinema(true);
        setLoadingStreaming(true);
        const [np, st] = await Promise.all([
          fetchNowPlaying(REGION, 1),
          fetchStreamingTrending({ region: REGION, providers: PROVIDERS, page: 1 }),
        ]);
        setCinema(np.results || []);
        setLoadingCinema(false);
        setStreaming(st.results || []);
        setLoadingStreaming(false);
      } catch (e) {
        console.error("Home load failed:", e);
        setErr("Could not load content. Please try again.");
        setLoadingCinema(false);
        setLoadingStreaming(false);
      }
    })();
  }, []);

  // Suggestion handler (called by SearchBar) - KR 25/08/2025
  const handleSearch = async (q) => {
    // guard tiny inputs - KR 25/08/2025
    if (!q || q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      setLoadingSearch(true);
      const data = await searchMovies(q.trim());
      setSuggestions(
        (data.results || [])
          .slice(0, 8)
          .map((m) => ({ id: m.id, label: m.title }))
      );
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  // Full results rail when user pauses typing - KR 25/08/2025
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!debounced || debounced.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const data = await searchMovies(debounced.trim());
        if (active) setResults(data.results || []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [debounced]);

  // helper to render one poster card (used by all rails) - KR 25/08/2025
  const PosterCard = ({ m }) => (
    <article className="poster-card">
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
      <div className="poster-meta">
        <div className="title">{m.title}</div>
        <div className="sub text-muted">Release Date: {formatDate(m.release_date)}</div>
      </div>
    </article>
  );

  return (
    <div className="container-fluid py-5">
      {/* Hero search wrapper - KR 25/08/2025 */}
      <section className="hero-search mb-5">
        <div className="container text-center">
          <h1 className="display-5 mb-3">Welcome to Cineflow</h1>
          <p className="lead mb-4">Search for your favourite films</p>

          {/* SearchBar with suggestions (type-ahead) - KR 25/08/2025 */}
          <div className="searchbar-wrapper mx-auto">
            <SearchBar
              value={query}
              onChange={setQuery}
              onSearch={handleSearch}
              isLoading={loadingSearch}
              suggestions={suggestions}
              onSelectSuggestion={(s) => {
                // replace text with chosen suggestion - KR 25/08/2025
                setQuery(s.label);
                // optional: could navigate to a detail page here
              }}
            />
          </div>
        </div>
      </section>

      {err && <div className="alert alert-danger">{err}</div>}

      {/* If user is searching, show search rail first - KR 25/08/2025 */}
      {query.trim().length >= 2 && (
        <>
          <h2 className="mb-3">🔎 Results for “{debounced}”</h2>
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
      <h2 className="mb-3">🎟️ What’s on in Cinemas</h2>
      <div className="reel-wrap mb-5">
        <button
          type="button"
          className="reel-btn left"
          aria-label="Scroll cinemas left"
          onClick={() => scrollReel(cinemaRef, -1)}
        >
          ‹
        </button>

        <div ref={cinemaRef} className="h-scroll">
          {loadingCinema ? (
            <SkeletonRow count={8} />
          ) : cinema.length ? (
            cinema.map((m) => <PosterCard key={`c-${m.id}`} m={m} />)
          ) : (
            <div className="text-muted p-2">No cinema listings.</div>
          )}
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

      {/* Trending on Streaming - KR 21/08/2025 */}
      <h2 className="mb-3">📺 Trending on Streaming</h2>
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
          {loadingStreaming ? (
            <SkeletonRow count={8} />
          ) : streaming.length ? (
            streaming.map((m) => <PosterCard key={`t-${m.id}`} m={m} />)
          ) : (
            <div className="text-muted p-2">No streaming results.</div>
          )}
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
  );
}