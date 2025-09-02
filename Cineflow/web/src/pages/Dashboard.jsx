import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMoodDiscover } from "@/api/movies";   // mood endpoint - KR 01/09/2025
import SkeletonRow from "@/components/SkeletonRow.jsx";
import "@/styles/home.css"; // reuse rails/chips look - KR 01/09/2025

function PosterCard({ m }) {
  return (
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
          {m.vote_average ? (
            <span className="badge-rating">{m.vote_average.toFixed(1)}</span>
          ) : null}
          <div className="poster-overlay" />
        </div>
        <div className="poster-meta">
          <div className="title" title={m.title}>{m.title}</div>
          <div className="sub text-muted">
            <span className="chip-year">{(m.release_date || "").slice(0,4) || "—"}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

// Mood options (keys match backend MOOD_RULES) - KR 01/09/2025
const MOODS = [
  { key: "feelgood",     label: "Feel-Good" },
  { key: "heartwarming", label: "Heartwarming" },
  { key: "high_energy",  label: "High Energy" },
  { key: "chill",        label: "Chill" },
  { key: "mind_bending", label: "Mind-Bending" },
  { key: "romantic",     label: "Romantic" },
  { key: "family",       label: "Family" },
  { key: "scary",        label: "Scary" },
  { key: "tearjerker",   label: "Tearjerker" },
  { key: "dark_gritty",  label: "Dark & Gritty" },
];

export default function Dashboard() {
  // Region + optional provider narrowing (reuse Home’s provider state later) - KR 01/09/2025
  const REGION = "GB";
  const [providersParam, setProvidersParam] = useState("");

  // Mood rail state - KR 01/09/2025
  const [mood, setMood] = useState("feelgood");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Infinite scroll sentinel - KR 01/09/2025
  const sentinelRef = useRef(null);

  // Initial + whenever mood/providers change (reset list) - KR 01/09/2025
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        setPage(1);
        const res = await fetchMoodDiscover({
          mood,
          region: REGION,
          providers: providersParam,
          types: "flatrate,ads,free",
          page: 1,

        });
        if (!active) return;
        const list = res.results || [];
        setItems(list);
        setHasMore((res.page || 1) < (res.total_pages || 1));
      } catch (e) {
        if (!active) return;
        console.error("Mood fetch failed:", e);
        setErr("Could not load mood picks.");
        setItems([]);
        setHasMore(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [mood, providersParam]);

  // Load more when sentinel is visible - KR 01/09/2025
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading) {
          (async () => {
            try {
              setLoading(true);
              const next = page + 1;
              const res = await fetchMoodDiscover({
                mood,
                region: REGION,
                providers: providersParam,
                types: "flatrate,ads,free",
                page: next,
              });
              const more = res.results || [];
              // Dedupe on append - KR 01/09/2025
              const seen = new Set(items.map((m) => m.id));
              const merged = [...items, ...more.filter((m) => m?.id && !seen.has(m.id))];
              setItems(merged);
              setPage(next);
              setHasMore((res.page || next) < (res.total_pages || next));
            } catch (e) {
              console.error("Mood load more failed:", e);
              setHasMore(false);
            } finally {
              setLoading(false);
            }
          })();
        }
      },
      { root: null, rootMargin: "600px 0px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, page, loading, mood, providersParam, items.length]);

  return (
    <div className="home-page">{/* reuse dark gradient + typography - KR 01/09/2025 */}
      <div className="container-fluid py-5">
        <header className="d-flex align-items-center justify-content-between mb-4">
          <h1 className="m-0">Your Dashboard</h1>
          <Link to="/" className="link-ghost">← Home</Link>
        </header>

        {/* Mood picker chips - KR 01/09/2025 */}
        <div className="section-head mb-2 d-flex align-items-center justify-content-between">
          <h2 className="m-0">🎯 Mood Picks</h2>
        </div>
        <div className="provider-filter mb-3 d-flex align-items-center gap-2 flex-wrap">
          <div className="pf-row">
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`pf-chip ${mood === m.key ? "active" : ""}`}
                onClick={() => setMood(m.key)}
                aria-pressed={mood === m.key}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {err && <div className="alert alert-danger mb-3">{err}</div>}

        {loading && items.length === 0 ? (
          <SkeletonRow count={8} />
        ) : items.length ? (
          <>
            <div className="reel-wrap">
              <div className="h-scroll">
                {items.map((mv) => (
                  <PosterCard key={`mood-${mv.id}`} m={mv} />
                ))}
              </div>
            </div>
            {/* Infinite-scroll sentinel - KR 01/09/2025 */}
            <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" style={{ height: 1 }} />
            {loading && <div className="text-muted mt-2">Loading more…</div>}
          </>
        ) : (
          <div className="text-muted">No picks for this mood. Try another mood or widen providers.</div>
        )}
      </div>
    </div>
  );
}