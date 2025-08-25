// Home.jsx - Main landing page for Cineflow - KR 21/08/2025
import React, { useEffect, useRef, useState } from "react";
import {
  fetchNowPlaying,
  fetchStreamingTrending,
} from "../api/movies"; // calls Django proxy - KR 21/08/2025
import "@/styles/home.css"; // make sure this is imported so reel styles apply - KR 22/08/2025

// util: format 'YYYY-MM-DD' -> 'DD/MM/YYYY' (fallbacks to "—") - KR 25/08/2025
const formatDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};


export default function Home() {
  // Local state for each section - KR 21/08/2025
  const [cinema, setCinema] = useState([]);
  const [streaming, setStreaming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Region defaults (make user-selectable later) - KR 21/08/2025
  const REGION = "IE";
  // Providers empty = all platforms (add picker later) - KR 21/08/2025
  const PROVIDERS = "";

  // refs for horizontal reels - KR 22/08/2025
  const cinemaRef = useRef(null);
  const streamingRef = useRef(null);

  // util: scroll reels by one “card” width * ~3 each click - KR 22/08/2025
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
        const [np, st] = await Promise.all([
          fetchNowPlaying(REGION, 1),
          fetchStreamingTrending({ region: REGION, providers: PROVIDERS, page: 1 }),
        ]);
        setCinema(np.results || []);
        setStreaming(st.results || []);
      } catch (e) {
        console.error("Home load failed:", e);
        setErr("Could not load content. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="container-fluid py-5">Loading…</div>;

  return (
    <div className="container-fluid py-5">
      <h1 className="mb-4">Welcome to Cineflow</h1>
      {err && <div className="alert alert-danger">{err}</div>}

      {/* What's on in Cinemas - KR 21/08/2025 */}
      <h2 className="mb-3">🎟️ What’s on in Cinemas</h2>

      {/* Reel wrapper with arrows (NO Bootstrap row/col here) - KR 22/08/2025 */}
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
          {cinema.length ? (
            cinema.map((m) => (
              <article key={m.id} className="poster-card">
                {m.poster_path ? (
                  <img
                    className="poster-img"
                    src={`https://image.tmdb.org/t/p/w500${m.poster_path}`}
                    alt={m.title}
                  />
                ) : (
                  // CSS note: define `.poster-fallback` height in CSS - KR 21/08/2025
                  <div className="poster-fallback d-flex align-items-center justify-content-center text-muted">
                    No Image
                  </div>
                )}
                <div className="poster-meta">
                  <div className="title">{m.title}</div>
                  <div className="sub text-muted">
                    Release Date: {formatDate(m.release_date)}
                  </div>
                </div>
              </article>
            ))
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

      {/* Reel wrapper with arrows (NO Bootstrap row/col here) - KR 22/08/2025 */}
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
          {streaming.length ? (
            streaming.map((m) => (
              <article key={m.id} className="poster-card">
                {m.poster_path ? (
                  <img
                    className="poster-img"
                    src={`https://image.tmdb.org/t/p/w500${m.poster_path}`}
                    alt={m.title}
                  />
                ) : (
                  // CSS note: reuse `.poster-fallback` - KR 21/08/2025
                  <div className="poster-fallback d-flex align-items-center justify-content-center text-muted">
                    No Image
                  </div>
                )}
                
                <div className="poster-meta">
                  <div className="title">{m.title}</div>
                  <div className="sub text-muted">
                    Release Date: {formatDate(m.release_date)}
                  </div>
                </div>
              </article>
            ))
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