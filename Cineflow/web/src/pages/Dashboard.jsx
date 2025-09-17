import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMoodDiscover } from "@/api/movies";
import SkeletonRow from "@/components/SkeletonRow.jsx";
import "@/styles/home.css";

// Poster card
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
          {m.vote_average ? <span className="badge-rating">{m.vote_average.toFixed(1)}</span> : null}
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

// Mood chips
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

// Decades
const DECADES = [
  { value: "", label: "Any decade" },
  { value: "2020s", label: "2020s" },
  { value: "2010s", label: "2010s" },
  { value: "2000s", label: "2000s" },
  { value: "1990s", label: "1990s" },
  { value: "1980s", label: "1980s" },
  { value: "1970s", label: "1970s" },
  { value: "1960s", label: "1960s" },
];

// TMDB thresholds
const TMDB_MIN_OPTIONS = [
  { value: 0,   label: "Any rating" },
  { value: 5.0, label: "≥ 5.0" },
  { value: 6.0, label: "≥ 6.0" },
  { value: 6.5, label: "≥ 6.5" },
  { value: 7.0, label: "≥ 7.0" },
  { value: 7.5, label: "≥ 7.5" },
  { value: 8.0, label: "≥ 8.0" },
];

// Whitelist (TMDB ids → label)
const PROVIDER_WHITELIST = {
  8: "Netflix",
  9: "Prime Video",
  337: "Disney+",
  531: "Paramount+",
};

export default function Dashboard() {
  const REGION = "GB";

  // Mood/list
  const [mood, setMood] = useState("feelgood");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Providers catalog (whitelisted + normalized)
  const [providers, setProviders] = useState([]);

  // APPLIED filters (used in requests)
  const [appliedDecade, setAppliedDecade] = useState("");
  const [appliedTmdbMin, setAppliedTmdbMin] = useState(0);
  const [appliedPickedProv, setAppliedPickedProv] = useState([]);

  // STAGED (UI)
  const [stagedDecade, setStagedDecade] = useState("");
  const [stagedTmdbMin, setStagedTmdbMin] = useState(0);
  const [stagedPickedProv, setStagedPickedProv] = useState([]);

  // Apply/Reset
  const [filterStamp, setFilterStamp] = useState(0);
  const applyFilters = () => {
    setAppliedDecade(stagedDecade);
    setAppliedTmdbMin(stagedTmdbMin);
    setAppliedPickedProv(stagedPickedProv);
    setFilterStamp((s) => s + 1);
  };
  const resetFilters = () => {
    setStagedDecade("");
    setStagedTmdbMin(0);
    setStagedPickedProv([]);
    setAppliedDecade("");
    setAppliedTmdbMin(0);
    setAppliedPickedProv([]);
    setFilterStamp((s) => s + 1);
  };

  // Dropdown ui
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Provider param (pipe-joined numeric ids)
  const providersParam = useMemo(() => {
    if (!appliedPickedProv.length) return "";
    const ids = Array.from(new Set(appliedPickedProv.map((x) => Number(x)).filter(Boolean)));
    return ids.join("|");
  }, [appliedPickedProv]);

  // Infinite scroll & abort
  const sentinelRef = useRef(null);
  const inFlightRef = useRef(null);

  // Fetch providers (once)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/movies/providers/?region=${encodeURIComponent(REGION)}`);
        if (!res.ok) throw new Error(`Providers HTTP ${res.status}`);
        const data = await res.json();
        const list = (data?.results || [])
          .filter((p) => PROVIDER_WHITELIST[p.provider_id])
          .map((p) => ({ ...p, provider_name: PROVIDER_WHITELIST[p.provider_id] }))
          .sort((a, b) => (a.provider_name || "").localeCompare(b.provider_name || ""));
        if (mounted) setProviders(list);
      } catch (e) {
        console.warn("Providers load failed", e);
      }
    })();
    return () => { mounted = false; };
  }, [REGION]);

  // Request params (ALWAYS send monetization types with COMMAS)
  const commonParams = useMemo(() => {
    const base = {
      region: REGION,
      decade: appliedDecade,
      tmdb_min: appliedTmdbMin,
      types: "flatrate,ads,free", // <— commas (backend expects this and forwards to TMDB)
    };
    if (providersParam) {
      base.providers = providersParam; // pipe-joined ids
    }
    return base;
  }, [REGION, appliedDecade, appliedTmdbMin, providersParam]);

  // Fetch (first load + on apply)
  useEffect(() => {
    if (inFlightRef.current) inFlightRef.current.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    let active = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        setPage(1);

        const res = await fetchMoodDiscover(
          { mood, page: 1, fast: true, ...commonParams },
          { signal: controller.signal }
        );
        if (!active) return;

        setItems(res.results || []);
        setHasMore((res.page || 1) < (res.total_pages || 1));
      } catch (e) {
        if (!active) return;
        if (e?.name !== "CanceledError" && e?.name !== "AbortError") {
          console.error("Mood fetch failed:", e);
          setErr("Could not load mood picks.");
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [mood, filterStamp, commonParams]);

  // Load more
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    let fetching = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !fetching) {
          fetching = true;
          const controller = new AbortController();
          (async () => {
            try {
              setLoading(true);
              const next = page + 1;
              const res = await fetchMoodDiscover(
                { mood, page: next, fast: false, ...commonParams },
                { signal: controller.signal }
              );
              const more = res.results || [];
              const seen = new Set(items.map((m) => m.id));
              const merged = [...items, ...more.filter((m) => m?.id && !seen.has(m.id))];
              setItems(merged);
              setPage(next);
              setHasMore((res.page || next) < (res.total_pages || next));
            } catch (e) {
              if (e?.name !== "CanceledError" && e?.name !== "AbortError") {
                console.error("Mood load more failed:", e);
                setHasMore(false);
              }
            } finally {
              setLoading(false);
              fetching = false;
            }
          })();
        }
      },
      { root: null, rootMargin: "600px 0px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, page, loading, mood, items, commonParams]);

  // Toggle staged provider
  const toggleProviderStaged = (idStr) => {
    setStagedPickedProv((prev) => {
      const set = new Set(prev);
      set.has(idStr) ? set.delete(idStr) : set.add(idStr);
      return Array.from(set);
    });
  };

  // Filters button label
  const selectedCount = stagedPickedProv.length + (stagedDecade ? 1 : 0) + (stagedTmdbMin ? 1 : 0);
  const filtersLabel = selectedCount ? `Filters • ${selectedCount}` : "Filters";

  return (
    <div className="home-page">
      <div className="container-fluid py-5">
        <header className="d-flex align-items-center justify-content-between mb-4">
          <h1 className="m-0">Your Dashboard</h1>
          <Link to="/" className="link-ghost">← Home</Link>
        </header>

        <div className="section-head mb-2 d-flex align-items-center justify-content-between">
          <h2 className="m-0">🎯 Mood Picks</h2>
        </div>

        <div className="mb-3 d-flex align-items-center gap-2 flex-wrap">
          <div className="pf-row">
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`pf-chip ${mood === m.key ? "active" : ""}`}
                onClick={() => setMood(m.key)}
                aria-pressed={mood === m.key}
                disabled={loading}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Filters dropdown */}
          <div className="ms-auto position-relative" ref={dropdownRef}>
            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="true"
            >
              {filtersLabel}
            </button>

            {open && (
              <div
                className="card shadow-sm p-3"
                role="menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "110%",
                  minWidth: 320,
                  zIndex: 1000,
                  background: "var(--bs-body-bg)",
                  borderRadius: "0.75rem",
                }}
              >
                {/* Decade */}
                <div className="mb-3">
                  <label className="form-label small text-muted">Decade</label>
                  <select
                    className="form-select form-select-sm"
                    value={stagedDecade}
                    onChange={(e) => setStagedDecade(e.target.value)}
                    disabled={loading}
                  >
                    {DECADES.map((d) => (
                      <option key={d.value || "any"} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {/* TMDB rating */}
                <div className="mb-3">
                  <label className="form-label small text-muted">TMDB rating</label>
                  <select
                    className="form-select form-select-sm"
                    value={stagedTmdbMin}
                    onChange={(e) => setStagedTmdbMin(Number(e.target.value))}
                    disabled={loading}
                  >
                    {TMDB_MIN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Providers */}
                <div className="mb-3">
                  <label className="form-label small text-muted">Providers</label>
                  <div className="border rounded p-2" style={{ maxHeight: 180, overflow: "auto" }}>
                    {(providers || []).map((p) => {
                      const idStr = String(p.provider_id);
                      const checked = stagedPickedProv.includes(idStr);
                      return (
                        <label
                          key={idStr}
                          className="d-flex align-items-center gap-2 py-1"
                          style={{ cursor: "pointer" }}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={checked}
                            onChange={() => toggleProviderStaged(idStr)}
                            disabled={loading}
                          />
                          <span className="small">{p.provider_name}</span>
                        </label>
                      );
                    })}
                    {!providers?.length && (
                      <div className="text-muted small">No providers loaded.</div>
                    )}
                  </div>
                  {stagedPickedProv.length > 0 && (
                    <div className="form-text">{stagedPickedProv.length} selected</div>
                  )}
                </div>

                {/* Actions */}
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={resetFilters}
                    disabled={loading}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => { applyFilters(); setOpen(false); }}
                    disabled={loading}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
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
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" style={{ height: 1 }} />
            {loading && <div className="text-muted mt-2">Loading more…</div>}
          </>
        ) : (
          <div className="text-muted">No picks for this mood. Try another mood or widen filters/providers.</div>
        )}
      </div>
    </div>
  );
}