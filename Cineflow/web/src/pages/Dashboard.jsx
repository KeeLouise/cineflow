// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMoodDiscover } from "@/api/movies";
import { getMyProfile } from "@/api/profile";
import { resendVerificationEmail } from "@/api/account";
import SkeletonRow from "@/components/SkeletonRow.jsx";
import "@/styles/home.css";

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
          {typeof m.vote_average === "number" ? (
            <span className="badge-rating">{m.vote_average.toFixed(1)}</span>
          ) : null}
          <div className="poster-overlay" />
        </div>
        <div className="poster-meta">
          <div className="title" title={m.title}>{m.title}</div>
          <div className="sub text-muted">
            <span className="chip-year">{(m.release_date || "").slice(0, 4) || "—"}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

const MOODS = [
  { key: "feelgood", label: "Feel-Good" },
  { key: "heartwarming", label: "Heartwarming" },
  { key: "high_energy", label: "High Energy" },
  { key: "chill", label: "Chill" },
  { key: "mind_bending", label: "Mind-Bending" },
  { key: "romantic", label: "Romantic" },
  { key: "family", label: "Family" },
  { key: "scary", label: "Scary" },
  { key: "tearjerker", label: "Tearjerker" },
  { key: "dark_gritty", label: "Dark & Gritty" },
];

const TMDB_MIN_OPTIONS = [
  { value: 0,   label: "Any rating" },
  { value: 5.0, label: "≥ 5.0" },
  { value: 6.0, label: "≥ 6.0" },
  { value: 6.5, label: "≥ 6.5" },
  { value: 7.0, label: "≥ 7.0" },
  { value: 7.5, label: "≥ 7.5" },
  { value: 8.0, label: "≥ 8.0" },
];

const REGION = "GB";

export default function Dashboard() {
  // signed-in user (banner)
  const [me, setMe] = useState(null);

  // mood/list
  const [mood, setMood] = useState("feelgood");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // applied filters (providers removed)
  const [appliedTmdbMin, setAppliedTmdbMin] = useState(0);
  const [appliedIncludeRentBuy, setAppliedIncludeRentBuy] = useState(false);

  // staged filters (UI)
  const [stagedMood, setStagedMood] = useState("feelgood");
  const [stagedTmdbMin, setStagedTmdbMin] = useState(0);
  const [stagedIncludeRentBuy, setStagedIncludeRentBuy] = useState(false);

  // apply/reset
  const [filterStamp, setFilterStamp] = useState(0);
  const applyFilters = () => {
    setMood(stagedMood);
    setAppliedTmdbMin(stagedTmdbMin);
    setAppliedIncludeRentBuy(stagedIncludeRentBuy);
    setFilterStamp((s) => s + 1);
  };
  const resetFilters = () => {
    setStagedMood("feelgood");
    setStagedTmdbMin(0);
    setStagedIncludeRentBuy(false);

    setMood("feelgood");
    setAppliedTmdbMin(0);
    setAppliedIncludeRentBuy(false);
    setFilterStamp((s) => s + 1);
  };

  // infinite scroll & abort
  const sentinelRef = useRef(null);
  const inFlightRef = useRef(null);

  // profile for banner
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await getMyProfile();
        if (alive) setMe(p || null);
      } catch {
        if (alive) setMe(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  // request params (providers removed)
  const commonParams = useMemo(() => {
    return {
      region: REGION,
      vote_average_gte: appliedTmdbMin || undefined,
      types: appliedIncludeRentBuy ? "ads,buy,flatrate,free,rent" : "flatrate,ads,free",
      broad: appliedIncludeRentBuy ? 1 : 0,
      force_providers: 0,
    };
  }, [appliedTmdbMin, appliedIncludeRentBuy]);

  // initial+apply fetch
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

  // load more
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
                setHasMore(false);
              }
            } finally {
              setLoading(false);
              fetching = false;
            }
          })();
        }
      },
      { root: null, rootMargin: "900px 0px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, page, loading, mood, items, commonParams]);

  const selectedCount =
    (stagedTmdbMin ? 1 : 0) +
    (stagedIncludeRentBuy ? 1 : 0) +
    (stagedMood !== mood ? 1 : 0);
  const filtersLabel = selectedCount ? `Filters • ${selectedCount}` : "Filters";

  const seeAllHref = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("region", REGION);
    if (appliedTmdbMin && Number(appliedTmdbMin) > 0) {
      qs.set("vote_average_gte", String(appliedTmdbMin));
    }
    qs.set("types", appliedIncludeRentBuy ? "ads,buy,flatrate,free,rent" : "flatrate,ads,free");
    return `/mood/${encodeURIComponent(mood)}/see-all?${qs.toString()}`;
  }, [mood, appliedTmdbMin, appliedIncludeRentBuy]);

  return (
    <>
      {/* Ensure full viewport height & centered */}
      <div className="page-bg" aria-hidden="true" />
      <div className="glass-dashboard" style={{ minHeight: "100vh" }}>
        <div className="container-fluid px-3 py-5">
          <div className="mx-auto" style={{ maxWidth: 1280 }}>
            {me && me.email_verified === false && (
              <div className="alert alert-warning d-flex align-items-center justify-content-between">
                <div>
                  <strong>Verify your email.</strong> We’ve sent a link to {me.email}. You’ll need to verify before enabling 2FA.
                </div>
                <button
                  className="btn btn-outline-ghost"
                  onClick={async () => {
                    try {
                      await resendVerificationEmail();
                      alert("Verification email sent.");
                    } catch (e) {
                      alert(e?.response?.data?.detail || "Could not send verification email.");
                    }
                  }}
                >
                  Resend
                </button>
              </div>
            )}

            <header className="d-flex align-items-center justify-content-between mb-4">
              <h1 className="m-0">Your Dashboard</h1>
              <div className="d-flex align-items-center gap-2">
                <Link to="/" className="link-ghost">← Home</Link>
                <Link to={seeAllHref} className="btn btn-sm btn-outline-light">See all</Link>
                <button
                  className="btn btn-sm btn-primary d-md-none"
                  type="button"
                  data-bs-toggle="offcanvas"
                  data-bs-target="#filtersOffcanvas"
                  aria-controls="filtersOffcanvas"
                >
                  {filtersLabel}
                </button>
              </div>
            </header>

            {/* Filters (providers removed) */}
            <div className="card bg-dark border-0 shadow-sm mb-4 d-none d-md-block">
              <div className="card-body">
                <div className="row g-3 align-items-end">
                  <div className="col-md-4">
                    <label className="form-label text-secondary small">Mood</label>
                    <select
                      className="form-select form-select-sm bg-dark text-light border-secondary"
                      value={stagedMood}
                      onChange={(e) => setStagedMood(e.target.value)}
                      disabled={loading}
                    >
                      {MOODS.map((m) => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label text-secondary small">TMDB rating</label>
                    <select
                      className="form-select form-select-sm bg-dark text-light border-secondary"
                      value={String(stagedTmdbMin)}
                      onChange={(e) => setStagedTmdbMin(Number(e.target.value))}
                      disabled={loading}
                    >
                      {TMDB_MIN_OPTIONS.map((o) => (
                        <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label text-secondary small d-block">Options</label>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="includeBuyRentSwitch"
                        checked={stagedIncludeRentBuy}
                        onChange={(e) => setStagedIncludeRentBuy(e.target.checked)}
                        disabled={loading}
                      />
                      <label className="form-check-label small text-white" htmlFor="includeBuyRentSwitch">
                        Include buy/rent results
                      </label>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-3">
                  <button type="button" className="btn btn-outline-warning btn-sm" onClick={resetFilters} disabled={loading}>
                    Reset
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={applyFilters} disabled={loading}>
                    Apply
                  </button>
                </div>
              </div>
            </div>

            {err && <div className="alert alert-danger mb-3">{err}</div>}

            {loading && items.length === 0 ? (
              <SkeletonRow count={8} />
            ) : items.length ? (
              <>
                <section className="section-card rail">
                  <div className="reel-wrap">
                    <div className="h-scroll">
                      {items.map((mv) => (
                        <PosterCard key={`mood-${mv.id}`} m={mv} />
                      ))}
                    </div>
                  </div>
                </section>

                <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" style={{ height: 1 }} />
                <div style={{ minHeight: 24 }} aria-live="polite" className="d-flex justify-content-center">
                  {loading && hasMore ? <span className="text-muted small">Loading more…</span> : null}
                </div>

                <div className="d-flex justify-content-center mt-3">
                  <Link to={seeAllHref} className="btn btn-outline-light btn-sm">
                    See all {MOODS.find((x) => x.key === mood)?.label || "results"}
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-muted">
                No picks for this mood. Try another mood or widen filters.
                {!!seeAllHref && (
                  <div className="mt-3">
                    <Link to={seeAllHref} className="btn btn-outline-light btn-sm">
                      Open full list
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MOBILE FILTERS */}
        <div
          className="offcanvas offcanvas-bottom bg-dark text-light d-md-none"
          tabIndex="-1"
          id="filtersOffcanvas"
          aria-labelledby="filtersOffcanvasLabel"
          style={{ height: "75vh" }}
        >
          <div className="offcanvas-header">
            <h5 className="offcanvas-title" id="filtersOffcanvasLabel">Filters</h5>
            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close" />
          </div>
          <div className="offcanvas-body">
            <div className="mb-3">
              <label className="form-label small text-secondary d-block">Mood</label>
              <select
                className="form-select form-select-sm bg-dark text-light border-secondary"
                value={stagedMood}
                onChange={(e) => setStagedMood(e.target.value)}
                disabled={loading}
              >
                {MOODS.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="row g-3">
              <div className="col-6">
                <label className="form-label small text-secondary">TMDB rating</label>
                <select
                  className="form-select form-select-sm bg-dark text-light border-secondary"
                  value={String(stagedTmdbMin)}
                  onChange={(e) => setStagedTmdbMin(Number(e.target.value))}
                  disabled={loading}
                >
                  {TMDB_MIN_OPTIONS.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small text-secondary d-block">Options</label>
                <div className="form-check form-switch mt-1">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="mobileBuyRent"
                    checked={stagedIncludeRentBuy}
                    onChange={(e) => setStagedIncludeRentBuy(e.target.checked)}
                    disabled={loading}
                  />
                  <label className="form-check-label" htmlFor="mobileBuyRent">
                    Include buy/rent results
                  </label>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-4">
              <button type="button" className="btn btn-outline-light" onClick={resetFilters}>Reset</button>
              <button
                type="button"
                className="btn btn-primary"
                data-bs-dismiss="offcanvas"
                onClick={applyFilters}
                disabled={loading}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
