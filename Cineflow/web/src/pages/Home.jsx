// Home.jsx - Main landing page for Cineflow - KR 21/08/2025
import React, { useEffect, useState } from "react";
import { fetchNowPlaying, fetchStreamingTrending } from "../api/movies"; // calls Django proxy - KR 21/08/2025

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

  if (loading) return <div className="container py-5">Loading…</div>;

  return (
    <div className="container py-5">
      <h1 className="mb-4">Welcome to Cineflow</h1>
      {err && <div className="alert alert-danger">{err}</div>}

      {/* What's on in Cinemas - KR 21/08/2025 */}
      <h2 className="mb-3">🎟️ What’s on in Cinemas</h2>
      <div className="row g-4 mb-5">
        {cinema.length ? (
          cinema.map((m) => (
            <div key={m.id} className="col-6 col-md-3">
              <div className="card h-100 shadow-sm">
                {m.poster_path ? (
                  <img
                    className="card-img-top"
                    src={`https://image.tmdb.org/t/p/w500${m.poster_path}`}
                    alt={m.title}
                  />
                ) : (
                  // CSS note: define `.poster-fallback` height in your CSS file - KR 21/08/2025
                  <div className="card-img-top poster-fallback d-flex align-items-center justify-content-center text-muted">
                    No Image
                  </div>
                )}
                <div className="card-body">
                  <h6 className="card-title mb-1">{m.title}</h6>
                  <small className="text-muted">{m.release_date || "—"}</small>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-muted">No cinema listings.</div>
        )}
      </div>

      {/* Trending on Streaming - KR 21/08/2025 */}
      <h2 className="mb-3">📺 Trending on Streaming</h2>
      <div className="row g-4">
        {streaming.length ? (
          streaming.map((m) => (
            <div key={m.id} className="col-6 col-md-3">
              <div className="card h-100 shadow-sm">
                {m.poster_path ? (
                  <img
                    className="card-img-top"
                    src={`https://image.tmdb.org/t/p/w500${m.poster_path}`}
                    alt={m.title}
                  />
                ) : (
                  // CSS note: reuse `.poster-fallback` - KR 21/08/2025
                  <div className="card-img-top poster-fallback d-flex align-items-center justify-content-center text-muted">
                    No Image
                  </div>
                )}
                <div className="card-body">
                  <h6 className="card-title mb-1">{m.title}</h6>
                  <small className="text-muted">{m.release_date || "—"}</small>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-muted">No streaming results.</div>
        )}
      </div>
    </div>
  );
}