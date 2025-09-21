import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { authFetch } from "@/api/auth";
import "@/styles/home.css";

const API_BASE = "/api";
const REGION = "GB";

// Change mood option - KR 20/09/2025
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

// UI provider options (mapped to TMDB IDs via /movies/providers/) - KR 19/09/2025
const ALLOWED_PROVIDERS = [
  { key: "netflix",        labels: ["Netflix"] },
  { key: "disney_plus",    labels: ["Disney+", "Disney Plus", "Disney Plus UK", "Star on Disney+"] },
  { key: "prime_video",    labels: ["Amazon Prime Video", "Prime Video"] },
  { key: "paramount_plus", labels: ["Paramount+", "Paramount Plus"] },
];

const DECADES = [
  { value: "",      label: "Any decade" },
  { value: "2020s", label: "2020s" },
  { value: "2010s", label: "2010s" },
  { value: "2000s", label: "2000s" },
  { value: "1990s", label: "1990s" },
  { value: "1980s", label: "1980s" },
  { value: "1970s", label: "1970s" },
  { value: "1960s", label: "1960s" },
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

function MovieCard({ m }) {
  const year = (m.release_date || "").slice(0, 4) || "—";
  const rating = typeof m.vote_average === "number" ? m.vote_average.toFixed(1) : null;
  const poster = m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null;

  return (
    <div className="col">
      <Link to={`/movie/${m.id}`} className="text-decoration-none">
        <div className="card h-100 bg-dark text-light border-0 shadow-sm">
          <div
            className="position-relative"
            style={{
              aspectRatio: "2/3",
              background:
                "radial-gradient(1200px 400px at 50% -200px, rgba(13,110,253,.25), rgba(13,110,253,0) 60%), #0b0b0b",
            }}
          >
            {poster ? (
              <img
                src={poster}
                alt={m.title}
                className="card-img-top h-100 w-100"
                style={{ objectFit: "cover" }}
                loading="lazy"
              />
            ) : (
              <div className="d-flex align-items-center justify-content-center h-100 text-secondary">
                No Image
              </div>
            )}
            {rating ? (
              <span className="badge bg-info text-dark position-absolute" style={{ top: 8, right: 8 }}>
                {rating}
              </span>
            ) : null}
          </div>
          <div className="card-body">
            <h6 className="card-title mb-1 text-truncate" title={m.title}>
              {m.title}
            </h6>
            <p className="card-text text-secondary mb-0">{year}</p>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function SeeAllPage() {
  const { mood } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Providers catalog (fetch once) - map ALLOWED_PROVIDERS to TMDB IDs - KR 19/09/2025
  const [providersMap, setProvidersMap] = useState({});
  const [provLoading, setProvLoading] = useState(true);

  // Filters (seed from query) - KR 19/09/2025
  const [decade, setDecade] = useState(searchParams.get("decade") || "");
  const [tmdbMin, setTmdbMin] = useState(Number(searchParams.get("vote_average_gte") || searchParams.get("tmdbMin") || 0));
  const [pickedProviders, setPickedProviders] = useState(() => {
    
    return [];
  });
  const [includeRentBuy, setIncludeRentBuy] = useState(searchParams.get("broad") === "1" || searchParams.get("includeRentBuy") === "1");

  // Data - KR 19/09/2025
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const sentinelRef = useRef(null);
  const inFlightRef = useRef(null);

  const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[’'"]/g, "").trim();

  // Providers map - KR 19/09/2025
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setProvLoading(true);
        const res = await fetch(`${API_BASE}/movies/providers/?region=${encodeURIComponent(REGION)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = data?.results || [];

        const map = {};
        ALLOWED_PROVIDERS.forEach((p) => {
          const match = list.find((row) => {
            const n = norm(row?.provider_name);
            return p.labels.some((lbl) => norm(lbl) === n);
          });
          if (match?.provider_id) map[p.key] = String(match.provider_id);
        });

        if (mounted) setProvidersMap(map);
      } catch (e) {
        console.warn("providers load failed", e);
        if (mounted) setProvidersMap({});
      } finally {
        if (mounted) setProvLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Build TMDB providers param - KR 19/09/2025
  const providersParam = useMemo(() => {
    const ids = pickedProviders.map((k) => providersMap[k]).filter(Boolean);
    if (!ids.length) return "";
    return Array.from(new Set(ids)).join("|");
  }, [pickedProviders, providersMap]);

  // Build query for backend - KR 19/09/2025
  const buildQuery = useCallback(
    (nextPage) => {
      const params = {
        region: REGION,
        page: nextPage,
        types: includeRentBuy ? "ads,buy,flatrate,free,rent" : "flatrate,ads,free",
      };
      if (providersParam) {
        params.providers = providersParam;
        params.broad = includeRentBuy ? 1 : 1;
        params.force_providers = 1;            
      } else if (includeRentBuy) {
        params.broad = 1;
      }
      if (decade) params.decade = decade;
      if (tmdbMin && !Number.isNaN(tmdbMin)) {
        params.vote_average_gte = tmdbMin;
        if (tmdbMin >= 7) params.min_votes = 50;
      }
      return params;
    },
    [providersParam, decade, tmdbMin, includeRentBuy]
  );

  const fetchPage = useCallback(
    async (nextPage, replace = false) => {
      if (inFlightRef.current) inFlightRef.current.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;

      try {
        if (nextPage === 1) setLoading(true);
        setErr("");

        const qs = new URLSearchParams(buildQuery(nextPage)).toString();

        const res = await authFetch(`${API_BASE}/movies/mood/${encodeURIComponent(mood)}/?${qs}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 401) throw new Error("Please log in to see mood results.");
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const list = data?.results || [];
        const totalPages = Math.max(1, Number(data?.total_pages || 1));

        if (replace) {
          setItems(list);
          setPage(1);
        } else {
          const seen = new Set((replace ? [] : items).map((m) => m.id));
          const merged = (replace ? [] : items).concat(list.filter((m) => m?.id && !seen.has(m.id)));
          setItems(merged);
          setPage(nextPage);
        }

        setHasMore(nextPage < totalPages);
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.error(e);
        setErr(e?.message || "Failed to load results");
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [mood, items, buildQuery]
  );

  // First load + when filters change - KR 19/09/2025
  useEffect(() => {
    fetchPage(1, true);
  }, [providersParam, decade, tmdbMin, includeRentBuy, mood]);

  // Infinite scroll - KR 19/09/2025
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    let fetching = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !fetching) {
          fetching = true;
          fetchPage(page + 1).finally(() => {
            fetching = false;
          });
        }
      },
      { root: null, rootMargin: "600px 0px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [sentinelRef, hasMore, loading, page, fetchPage]);

  // UI handlers - KR 19/09/2025
  const toggleProvider = (key) => {
    setPickedProviders((prev) => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return Array.from(s);
    });
  };

  const resetFilters = () => {
    setDecade("");
    setTmdbMin(0);
    setPickedProviders([]);
    setIncludeRentBuy(false);
  };

  // Mood change (navigates but preserves current query filters) - KR 20/09/2025
  const handleMoodChange = (newMood) => {
    if (!newMood || newMood === mood) return;
    const next = new URLSearchParams(buildQuery(1));
    navigate(`/mood/${encodeURIComponent(newMood)}/see-all?${next.toString()}`);
  };

  // Selected filters summary (chips)
  const chips = useMemo(() => {
    const c = [];
    if (pickedProviders.length) c.push(`${pickedProviders.length} provider${pickedProviders.length > 1 ? "s" : ""}`);
    if (decade) c.push(decade);
    if (tmdbMin) c.push(`TMDB ≥ ${tmdbMin}`);
    if (includeRentBuy) c.push("Include buy/rent");
    return c;
  }, [pickedProviders, decade, tmdbMin, includeRentBuy]);

  const loadingInitial = loading && items.length === 0;

  return (
    <>
      {/* Fixed background that the glass layer will blur */}
      <div className="page-bg" aria-hidden="true" />

      {/* Glass wrapper for the whole page */}
      <div className="glass-dashboard">
        <div className="container-fluid py-5">
          {/* Header */}
          <div className="mb-3 d-flex align-items-center justify-content-between">
            <div>
              <h1 className="h3 m-0 text-white text-capitalize">
                See all — {(mood || "").replace(/_/g, " ")}
              </h1>
              <div className="mt-2 d-flex flex-wrap gap-2">
                {chips.length ? (
                  chips.map((txt, i) => (
                    <span
                      key={i}
                      className="badge rounded-pill bg-gradient"
                      style={{ background: "linear-gradient(90deg, #0dcaf0, #6610f2)" }}
                    >
                      {txt}
                    </span>
                  ))
                ) : (
                  <span className="text-secondary small">No filters applied</span>
                )}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <Link className="btn btn-outline-light btn-sm" to="/">
                ← Home
              </Link>
              <button
                className="btn btn-primary btn-sm d-md-none"
                type="button"
                data-bs-toggle="offcanvas"
                data-bs-target="#filtersOffcanvas"
                aria-controls="filtersOffcanvas"
              >
                Filters
              </button>
            </div>
          </div>

          {/* Desktop filter toolbar */}
          <div className="card bg-dark border-0 shadow-sm mb-4 d-none d-md-block">
            <div className="card-body">
              <div className="row g-3 align-items-end">
                {/* Mood */}
                <div className="col-md-3">
                  <label className="form-label text-secondary small">Mood</label>
                  <select
                    className="form-select form-select-sm bg-dark text-light border-secondary"
                    value={mood}
                    onChange={(e) => handleMoodChange(e.target.value)}
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
                      const active = pickedProviders.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          className={`btn btn-sm ${active ? "btn-info text-dark" : "btn-outline-info"}`}
                          onClick={() => toggleProvider(p.key)}
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
                    value={decade}
                    onChange={(e) => setDecade(e.target.value)}
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
                    value={String(tmdbMin)}
                    onChange={(e) => setTmdbMin(Number(e.target.value))}
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
                      checked={includeRentBuy}
                      onChange={(e) => setIncludeRentBuy(e.target.checked)}
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
                  onClick={() => fetchPage(1, true)}
                  disabled={loading}
                  title="Apply filters"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Errors */}
          {err && <div className="alert alert-danger">{err}</div>}

          {/* Grid */}
          {loadingInitial ? (
            <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="col">
                  <div className="card h-100 bg-dark border-0">
                    <div className="placeholder-glow" style={{ aspectRatio: "2/3", background: "#0f0f0f" }}>
                      <span className="placeholder col-12 h-100 w-100 d-block"></span>
                    </div>
                    <div className="card-body">
                      <p className="card-text placeholder-glow mb-1">
                        <span className="placeholder col-8"></span>
                      </p>
                      <p className="card-text placeholder-glow mb-0">
                        <span className="placeholder col-4"></span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : items.length ? (
            <>
              <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-3">
                {items.map((m) => (
                  <MovieCard key={m.id} m={m} />
                ))}
              </div>

              {/* Load more + sentinel for infinite scroll */}
              <div className="d-flex justify-content-center mt-3">
                {hasMore ? (
                  <button
                    type="button"
                    className="btn btn-outline-light"
                    onClick={() => fetchPage(page + 1)}
                    disabled={loading}
                  >
                    {loading ? "Loading…" : "Load more"}
                  </button>
                ) : (
                  <div className="text-secondary small py-2">No more results.</div>
                )}
              </div>
              <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
            </>
          ) : (
            <div className="text-secondary">No results. Try widening filters or removing a provider.</div>
          )}
        </div>

        {/* MOBILE FILTERS: Off-canvas sheet (mirrors Dashboard) */}
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
                value={mood}
                onChange={(e) => handleMoodChange(e.target.value)}
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
                  const active = pickedProviders.includes(p.key);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={`btn btn-sm ${active ? "btn-info text-dark" : "btn-outline-info"}`}
                      onClick={() => toggleProvider(p.key)}
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
                  value={decade}
                  onChange={(e) => setDecade(e.target.value)}
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
                  value={String(tmdbMin)}
                  onChange={(e) => setTmdbMin(Number(e.target.value))}
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
                  checked={includeRentBuy}
                  onChange={(e) => setIncludeRentBuy(e.target.checked)}
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
                onClick={() => fetchPage(1, true)}
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