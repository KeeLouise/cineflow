// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMoodDiscover } from "@/api/movies";
import { getMyProfile } from "@/api/profile";
import { resendVerificationEmail } from "@/api/account";
import SkeletonRow from "@/components/SkeletonRow.jsx";
import "@/styles/home.css";

/* Poster card */
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

// See-All style provider options (mapped by provider_name -> provider_id)
const ALLOWED_PROVIDERS = [
  { key: "netflix",        labels: ["Netflix"] },
  { key: "disney_plus",    labels: ["Disney+", "Disney Plus", "Disney Plus UK", "Star on Disney+"] },
  { key: "prime_video",    labels: ["Amazon Prime Video", "Prime Video"] },
  { key: "paramount_plus", labels: ["Paramount+", "Paramount Plus"] },
];

const API_BASE = "/api";
const REGION = "GB";

export default function Dashboard() {
  // Signed-in user (for email verification banner)
  const [me, setMe] = useState(null);

  // Mood/list
  const [mood, setMood] = useState("feelgood");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Providers catalog (name→id map like See-All)
  const [providersMap, setProvidersMap] = useState({});
  const [provLoading, setProvLoading] = useState(true);

  // APPLIED filters (used in requests)
  const [appliedDecade, setAppliedDecade] = useState("");
  const [appliedTmdbMin, setAppliedTmdbMin] = useState(0);
  const [appliedPickedProviders, setAppliedPickedProviders] = useState([]); // keys from ALLOWED_PROVIDERS
  const [appliedIncludeRentBuy, setAppliedIncludeRentBuy] = useState(false);

  // STAGED UI (edit here, apply to above on Apply)
  const [stagedMood, setStagedMood] = useState("feelgood");
  const [stagedDecade, setStagedDecade] = useState("");
  const [stagedTmdbMin, setStagedTmdbMin] = useState(0);
  const [stagedPickedProviders, setStagedPickedProviders] = useState([]); // keys
  const [stagedIncludeRentBuy, setStagedIncludeRentBuy] = useState(false);

  // Apply/Reset
  const [filterStamp, setFilterStamp] = useState(0);
  const applyFilters = () => {
    setMood(stagedMood);
    setAppliedDecade(stagedDecade);
    setAppliedTmdbMin(stagedTmdbMin);
    setAppliedPickedProviders(stagedPickedProviders);
    setAppliedIncludeRentBuy(stagedIncludeRentBuy);
    setFilterStamp((s) => s + 1);
  };
  const resetFilters = () => {
    setStagedMood("feelgood");
    setStagedDecade("");
    setStagedTmdbMin(0);
    setStagedPickedProviders([]);
    setStagedIncludeRentBuy(false);

    setMood("feelgood");
    setAppliedDecade("");
    setAppliedTmdbMin(0);
    setAppliedPickedProviders([]);
    setAppliedIncludeRentBuy(false);
    setFilterStamp((s) => s + 1);
  };

  // Infinite scroll & abort
  const sentinelRef = useRef(null);
  const inFlightRef = useRef(null);

  // Load profile for banner
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await getMyProfile();
        if (alive) setMe(p);
      } catch {
        if (alive) setMe(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Providers (fetch once; map names to ids like See-All)
  const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[’'"]/g, "").trim();
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setProvLoading(true);
        const res = await fetch(`${API_BASE}/movies/providers/?region=${encodeURIComponent(REGION)}`);
        if (!res.ok) throw new Error(`Providers HTTP ${res.status}`);
        const data = await res.json();
        const list = data?.results || [];

        const map = {};
        ALLOWED_PROVIDERS.forEach((p) => {
          const match = list.find((row) => p.labels.some((lbl) => norm(lbl) === norm(row?.provider_name)));
          if (match?.provider_id) map[p.key] = String(match.provider_id);
        });

        if (mounted) setProvidersMap(map);
      } catch (e) {
        console.warn("Providers load failed", e);
        if (mounted) setProvidersMap({});
      } finally {
        if (mounted) setProvLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Build providers param from applied keys -> TMDB ids
  const providersParam = useMemo(() => {
    const ids = (appliedPickedProviders || []).map((k) => providersMap[k]).filter(Boolean);
    if (!ids.length) return "";
    return Array.from(new Set(ids)).join("|");
  }, [appliedPickedProviders, providersMap]);

  // Request params (ALWAYS commas for monetization types)
  const commonParams = useMemo(() => {
    const base = {
      region: REGION,
      decade: appliedDecade,
      vote_average_gte: appliedTmdbMin || undefined,
      types: appliedIncludeRentBuy ? "ads,buy,flatrate,free,rent" : "flatrate,ads,free",
      broad: appliedPickedProviders.length ? 1 : 0,
      force_providers: appliedPickedProviders.length ? 1 : 0,
    };
    if (providersParam) base.providers = providersParam;
    return base;
  }, [
    appliedDecade,
    appliedTmdbMin,
    providersParam,
    appliedIncludeRentBuy,
    appliedPickedProviders.length,
  ]);

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

  // Toggle staged provider (name-keyed, like See-All)
  const toggleProviderStaged = (key) => {
    setStagedPickedProviders((prev) => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return Array.from(s);
    });
  };

  // Filters label
  const selectedCount =
    (stagedPickedProviders.length ? 1 : 0) +
    (stagedDecade ? 1 : 0) +
    (stagedTmdbMin ? 1 : 0) +
    (stagedIncludeRentBuy ? 1 : 0) +
    (stagedMood !== mood ? 1 : 0);
  const filtersLabel = selectedCount ? `Filters • ${selectedCount}` : "Filters";

  // See-All link
  const providersParamForSeeAll = useMemo(() => {
    const ids = (appliedPickedProviders || []).map((k) => providersMap[k]).filter(Boolean);
    return ids.length ? Array.from(new Set(ids)).join("|") : "";
  }, [appliedPickedProviders, providersMap]);

  const seeAllHref = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("region", REGION);
    if (appliedDecade) qs.set("decade", appliedDecade);
    if (appliedTmdbMin && Number(appliedTmdbMin) > 0) {
      qs.set("vote_average_gte", String(appliedTmdbMin));
    }
    if (providersParamForSeeAll) {
      qs.set("providers", providersParamForSeeAll);
      qs.set("broad", appliedIncludeRentBuy ? "1" : "0");
      qs.set("force_providers", "1");
    }
    qs.set("types", appliedIncludeRentBuy ? "ads,buy,flatrate,free,rent" : "flatrate,ads,free");
    return `/mood/${encodeURIComponent(mood)}/see-all?${qs.toString()}`;
  }, [REGION, mood, appliedDecade, appliedTmdbMin, providersParamForSeeAll, appliedIncludeRentBuy]);

  return (
    <>
      {/* Fixed background that the glass layer will blur */}
      <div className="page-bg" aria-hidden="true" />

      {/* Glass wrapper for the whole page */}
      <div className="glass-dashboard">
        <div className="container-fluid py-5">

          {/* EMAIL VERIFICATION BANNER */}
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
              {/* Mobile Filters trigger */}
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

          {/* Desktop filter toolbar */}
          <div className="card bg-dark border-0 shadow-sm mb-4 d-none d-md-block">
            <div className="card-body">
              <div className="row g-3 align-items-end">
                {/* Mood */}
                <div className="col-md-3">
                  <label className="form-label text-secondary small">Mood</label>
                  <select
                    className="form-select form-select-sm bg-dark text-light border-secondary"
                    value={stagedMood}
                    onChange={(e) => setStagedMood(e.target.value)}
                    disabled={loading}
                  >
                    {MOODS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Providers */}
                <div className="col-md-5">
                  <label className="form-label text-secondary small d-block">Providers</label>
                  <div className="d-flex flex-wrap gap-2">
                    {ALLOWED_PROVIDERS.map((p) => {
                      const disabled = provLoading || !providersMap[p.key];
                      const active = stagedPickedProviders.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          className={`btn btn-sm ${active ? "btn-info text-dark" : "btn-outline-info"}`}
                          onClick={() => toggleProviderStaged(p.key)}
                          disabled={disabled || loading}
                          title={disabled ? "Not available in this region" : p.labels[0]}
                        >
                          {p.labels[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Decade */}
                <div className="col-md-2">
                  <label className="form-label text-secondary small">Decade</label>
                  <select
                    className="form-select form-select-sm bg-dark text-light border-secondary"
                    value={stagedDecade}
                    onChange={(e) => setStagedDecade(e.target.value)}
                    disabled={loading}
                  >
                    {DECADES.map((d) => (
                      <option key={d.value || "any"} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* TMDB rating */}
                <div className="col-md-2">
                  <label className="form-label text-secondary small">TMDB rating</label>
                  <select
                    className="form-select form-select-sm bg-dark text-light border-secondary"
                    value={String(stagedTmdbMin)}
                    onChange={(e) => setStagedTmdbMin(Number(e.target.value))}
                    disabled={loading}
                  >
                    {TMDB_MIN_OPTIONS.map((o) => (
                      <option key={String(o.value)} value={String(o.value)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Include buy/rent */}
                <div className="col-md-3">
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

              {/* Actions */}
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-outline-warning btn-sm"
                  onClick={resetFilters}
                  disabled={loading}
                  title="Reset all filters"
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={applyFilters}
                  disabled={loading}
                  title="Apply filters"
                >
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
              <div className="reel-wrap">
                <div className="h-scroll">
                  {items.map((mv) => (
                    <PosterCard key={`mood-${mv.id}`} m={mv} />
                  ))}
                </div>
              </div>

              <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" style={{ height: 1 }} />
              {loading && <div className="text-muted mt-2">Loading more…</div>}

              <div className="d-flex justify-content-center mt-3">
                <Link to={seeAllHref} className="btn btn-outline-light btn-sm">
                  See all {MOODS.find((x) => x.key === mood)?.label || "results"}
                </Link>
              </div>
            </>
          ) : (
            <div className="text-muted">
              No picks for this mood. Try another mood or widen filters/providers.
              {!!seeAllHref && (
                <div className="mt-3">
                  <Link to={seeAllHref} className="btn btn-outline-light btn-sm">Open full list</Link>
                </div>
              )}
            </div>
          )}
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
            <h5 className="offcanvas-title" id="filtersOffcanvasLabel">
              Filters
            </h5>
            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close" />
          </div>
          <div className="offcanvas-body">
            {/* Mood selector (mobile) */}
            <div className="mb-3">
              <label className="form-label small text-secondary d-block">Mood</label>
              <select
                className="form-select form-select-sm bg-dark text-light border-secondary"
                value={stagedMood}
                onChange={(e) => setStagedMood(e.target.value)}
                disabled={loading}
              >
                {MOODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Providers */}
            <div className="mb-3">
              <label className="form-label small text-secondary d-block">Providers</label>
              <div className="d-flex flex-wrap gap-2">
                {ALLOWED_PROVIDERS.map((p) => {
                  const disabled = provLoading || !providersMap[p.key];
                  const active = stagedPickedProviders.includes(p.key);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={`btn btn-sm ${active ? "btn-info text-dark" : "btn-outline-info"}`}
                      onClick={() => toggleProviderStaged(p.key)}
                      disabled={disabled || loading}
                      title={disabled ? "Not available in this region" : p.labels[0]}
                    >
                      {p.labels[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Decade + Rating */}
            <div className="row g-3">
              <div className="col-6">
                <label className="form-label small text-secondary">Decade</label>
                <select
                  className="form-select form-select-sm bg-dark text-light border-secondary"
                  value={stagedDecade}
                  onChange={(e) => setStagedDecade(e.target.value)}
                  disabled={loading}
                >
                  {DECADES.map((d) => (
                    <option key={d.value || "any"} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small text-secondary">TMDB rating</label>
                <select
                  className="form-select form-select-sm bg-dark text-light border-secondary"
                  value={String(stagedTmdbMin)}
                  onChange={(e) => setStagedTmdbMin(Number(e.target.value))}
                  disabled={loading}
                >
                  {TMDB_MIN_OPTIONS.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Include buy/rent (mobile) */}
            <div className="mt-3 d-flex gap-4">
              <div className="form-check form-switch">
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

            {/* Actions */}
            <div className="d-flex justify-content-between align-items-center mt-4">
              <button type="button" className="btn btn-outline-light" onClick={resetFilters}>
                Reset
              </button>
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