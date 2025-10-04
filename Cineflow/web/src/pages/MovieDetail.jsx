// MovieDetail.jsx — Detail page with poster-derived colours (mobile-safe) — KR
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchMovieDetail } from "@/api/movies";
import { fetchMyWatchlists, addMovieToWatchlist } from "@/api/watchlists";
import { looksLoggedIn } from "@/api/auth";
import SkeletonRow from "@/components/SkeletonRow.jsx";
import "@/styles/movie.css";

/* ---------- Mobile-safe poster palette hook ----------
   1) Try server endpoint (/api/movies/poster_palette/) first (no CORS/canvas)
   2) Fallback: client extraction from a small TMDB image (w185)
      - crossOrigin set BEFORE src (required on iOS Safari)
      - try window.ColorThief if available, else average pixels via canvas
------------------------------------------------------ */
function usePosterPalette(posterPath) {
  const [palette, setPalette] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    if (!posterPath) {
      setPalette(null);
      return () => {};
    }

    (async () => {
      // 1) Server-side palette (preferred)
      try {
        const res = await fetch(
          `/api/movies/poster_palette/?path=${encodeURIComponent(`/t/p/w500${posterPath}`)}`
        );
        if (res.ok) {
          const { palette: server = [] } = await res.json();
          if (alive && server?.length) {
            setPalette(server);
            return;
          }
        }
      } catch {
        /* continue to client fallback */
      }

      // 2) Client fallback — small image + strict CORS handling
      try {
        const url = `https://image.tmdb.org/t/p/w185${posterPath}`;
        const img = new Image();
        img.crossOrigin = "anonymous";      // must set before src on iOS
        img.referrerPolicy = "no-referrer"; // avoid referrer-related blocks
        img.decoding = "sync";
        img.src = url;

        // Ensure decode before sampling
        await (img.decode?.() ||
          new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
          }));

        if (window.ColorThief) {
          const thief = new window.ColorThief();
          const primary = thief.getColor(img);
          const pals = thief.getPalette(img, 5) || [];
          const merged = [primary, ...pals].filter(Boolean);
          if (alive && merged.length) {
            setPalette(merged);
            return;
          }
        }

        // 3) Average pixels as last resort (tiny canvas sample)
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const W = 50,
          H = 50;
        canvas.width = W;
        canvas.height = H;
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        const avg = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
        if (alive) setPalette([avg]);
      } catch {
        if (alive) setPalette(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [posterPath]);

  return palette; // [[r,g,b], ...] or null
}

// util: format 'YYYY-MM-DD' -> 'DD/MM/YYYY'
const formatDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// map a provider name to a link (home for big 4, otherwise JustWatch search)
const providerLink = (name, title, region = "IE") => {
  const n = (name || "").toLowerCase();
  if (n.includes("netflix")) return "https://www.netflix.com/";
  if (n.includes("disney")) return "https://www.disneyplus.com/";
  if (n.includes("prime")) return "https://www.primevideo.com/";
  if (n.includes("paramount")) return "https://www.paramountplus.com/";
  const q = encodeURIComponent(title || "");
  return `https://www.justwatch.com/${region.toLowerCase()}/search?q=${q}`;
};

export default function MovieDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // --- Watchlist UI state ---
  const authed = looksLoggedIn();
  const [lists, setLists] = useState([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState(null);

  const [selectedListId, setSelectedListId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // fetch movie detail
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const payload = await fetchMovieDetail(id);
        if (active) setData(payload);
      } catch (e) {
        console.error(e);
        if (active) setErr("Failed to load movie details.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // fetch user's watchlists (if authed)
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    setListsLoading(true);
    setListsError(null);

    (async () => {
      try {
        const data = await fetchMyWatchlists();
        if (!alive) return;
        setLists(data || []);
        if (data && data.length > 0) {
          setSelectedListId(String(data[0].id));
        }
      } catch (err) {
        if (!alive) return;
        setListsError(err.message || "Failed to load your watchlists.");
      } finally {
        if (alive) setListsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authed]);

  async function handleAddToWatchlist() {
    setSaveMsg("");
    setSaveError("");

    if (!selectedListId) {
      setSaveError("Please select a watchlist first.");
      return;
    }

    const moviePayload = {
      id: Number(id),
      title: data.title || "",
      poster_path: data.poster_path || "",
    };

    try {
      setSaving(true);
      await addMovieToWatchlist(selectedListId, moviePayload);
      setSaveMsg("Added to your watchlist!");
      setPickerOpen(false);
    } catch (err) {
      setSaveError(err.message || "Could not add to watchlist.");
    } finally {
      setSaving(false);
    }
  }

  // derive palette + set CSS vars (for gradient background)
  const poster_path = data?.poster_path || null;
  const palette = usePosterPalette(poster_path);
  useEffect(() => {
    let start = "rgb(20,20,20)";
    let end = "rgb(0,0,0)";
    let accent = "rgb(35,35,35)";

    if (Array.isArray(palette) && palette.length) {
      const p0 = palette[0] || [20, 20, 20];
      const p1 = palette[1] || p0;
      const p2 = palette[2] || p0;

      const soften = (arr, mult = 0.9) => {
        const [r, g, b] = arr;
        return `rgb(${Math.round(r * mult)}, ${Math.round(g * mult)}, ${Math.round(
          b * mult
        )})`;
      };

      start = soften(p0, 0.9);
      end = soften(p1, 0.7);
      accent = soften(p2, 1.0);
    }

    const root = document.documentElement.style;
    root.setProperty("--movie-bg-start", start);
    root.setProperty("--movie-bg-end", end);
    root.setProperty("--movie-accent", accent);
  }, [palette]);

  if (loading) {
    return (
      <div className="container py-5">
        <SkeletonRow count={6} />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger mb-4">{err || "Not found"}</div>
        <Link to="/" className="btn btn-outline-secondary">
          ← Back home
        </Link>
      </div>
    );
  }

  const {
    title,
    overview,
    release_date,
    runtime,
    genres = [],
    vote_average,
    vote_count,
    credits = { cast: [], crew: [] },
    videos = { results: [] },
    watch_providers = { results: {} },
    providers,
  } = data;

  // region fallback chain for provider blocks
  const ieProviders =
    providers || watch_providers.results?.IE || watch_providers.results?.US || {};

  const cast = (credits.cast || []).slice(0, 14);
  const trailer = (videos.results || []).find(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );

  return (
    <div className="movie-page">
      <div className="container py-5">
        <div className="row g-4 align-items-start">
          {/* Poster column — centered on mobile */}
          <div className="col-12 col-md-auto text-center text-md-start">
            {poster_path ? (
              <img
                className="movie-poster mx-auto mx-md-0"
                src={`https://image.tmdb.org/t/p/w500${poster_path}`}
                alt={title}
                crossOrigin="anonymous"
              />
            ) : (
              <div className="movie-poster fallback d-flex align-items-center justify-content-center text-muted mx-auto mx-md-0">
                No Image
              </div>
            )}
          </div>

          {/* Text/content column */}
          <div className="col">
            <h1 className="movie-title mb-2">{title}</h1>

            {/* Meta chips */}
            <div className="movie-meta mb-3">
              <span className="chip">Release Date: {formatDate(release_date)}</span>
              {runtime ? <span className="chip">{runtime} min</span> : null}
              {genres.length ? (
                <span className="chip chip-soft">
                  {genres.map((g) => g.name).join(" • ")}
                </span>
              ) : null}
              {vote_average ? (
                <span className="chip rating">
                  ★ {vote_average.toFixed(1)}{" "}
                  <span className="muted">({vote_count?.toLocaleString?.() || 0})</span>
                </span>
              ) : null}
            </div>

            {/* Overview */}
            <p className="movie-overview">{overview || "No overview available."}</p>

            {/* Primary actions */}
            <div className="actions mt-3 d-flex flex-wrap gap-2 align-items-center">
              <Link to="/dashboard" className="btn btn-ghost">
                ← Back
              </Link>

              {/* Watchlist picker */}
              {authed ? (
                <div className="position-relative d-inline-block">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setSaveMsg("");
                      setSaveError("");
                      setPickerOpen((open) => !open);
                    }}
                    aria-expanded={pickerOpen ? "true" : "false"}
                    aria-controls="watchlist-picker"
                  >
                    Add to Watchlist
                  </button>

                  {pickerOpen && (
                    <div
                      id="watchlist-picker"
                      className="card p-2 position-absolute z-3 shadow"
                      // Safer placement on small screens: drop below, align right
                      style={{
                        minWidth: 280,
                        top: "calc(100% + 8px)",
                        right: 0,
                      }}
                    >
                      {listsLoading && (
                        <div className="text-muted">Loading your lists…</div>
                      )}
                      {listsError && (
                        <div className="text-danger mb-2">Error: {listsError}</div>
                      )}

                      {!listsLoading && !listsError && (
                        <>
                          {lists.length === 0 ? (
                            <div className="text-muted">
                              You don’t have any watchlists yet. Create one on the{" "}
                              <a href="/watchlists">Watchlists</a> page.
                            </div>
                          ) : (
                            <div className="d-flex gap-2 align-items-center">
                              <select
                                className="form-select w-auto"
                                value={selectedListId}
                                onChange={(e) => {
                                  setSaveMsg("");
                                  setSaveError("");
                                  setSelectedListId(e.target.value);
                                }}
                                disabled={saving}
                                aria-label="Choose a watchlist"
                              >
                                {lists.map((wl) => (
                                  <option key={wl.id} value={wl.id}>
                                    {wl.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleAddToWatchlist}
                                disabled={saving || !selectedListId}
                                aria-busy={saving ? "true" : "false"}
                              >
                                {saving ? "Adding…" : "Add"}
                              </button>

                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setPickerOpen(false)}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {saveMsg && <div className="text-success mt-2">{saveMsg}</div>}
                      {saveError && <div className="text-danger mt-2">{saveError}</div>}
                    </div>
                  )}
                </div>
              ) : (
                <a href="/login" className="btn btn-outline-secondary">
                  Log in to save
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div className="container section-stack">
        {/* Where to Watch */}
        {(ieProviders.flatrate?.length ||
          ieProviders.ads?.length ||
          ieProviders.free?.length ||
          ieProviders.rent?.length ||
          ieProviders.buy?.length) && (
          <section className="providers-block card-block glass">
            <h2 className="h5 mb-3">Where to Watch</h2>

            {(ieProviders.flatrate || []).length > 0 && (
              <div className="provider-row">
                <div className="label">Included</div>
                <div className="logos">
                  {ieProviders.flatrate.map((p) => (
                    <a
                      key={`fl-${p.provider_id}`}
                      className="provider-chip"
                      href={providerLink(p.provider_name, title, "IE")}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${p.provider_name}`}
                      aria-label={`Open ${p.provider_name}`}
                    >
                      <img
                        src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                        alt={p.provider_name}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(ieProviders.ads || []).length > 0 && (
              <div className="provider-row">
                <div className="label">Ad-supported</div>
                <div className="logos">
                  {ieProviders.ads.map((p) => (
                    <a
                      key={`ads-${p.provider_id}`}
                      className="provider-chip"
                      href={providerLink(p.provider_name, title, "IE")}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${p.provider_name}`}
                      aria-label={`Open ${p.provider_name}`}
                    >
                      <img
                        src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                        alt={p.provider_name}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(ieProviders.free || []).length > 0 && (
              <div className="provider-row">
                <div className="label">Free</div>
                <div className="logos">
                  {ieProviders.free.map((p) => (
                    <a
                      key={`free-${p.provider_id}`}
                      className="provider-chip"
                      href={providerLink(p.provider_name, title, "IE")}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${p.provider_name}`}
                      aria-label={`Open ${p.provider_name}`}
                    >
                      <img
                        src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                        alt={p.provider_name}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(ieProviders.rent || []).length > 0 && (
              <div className="provider-row">
                <div className="label">Rent</div>
                <div className="logos">
                  {ieProviders.rent.map((p) => (
                    <a
                      key={`rent-${p.provider_id}`}
                      className="provider-chip"
                      href={providerLink(p.provider_name, title, "IE")}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${p.provider_name}`}
                      aria-label={`Open ${p.provider_name}`}
                    >
                      <img
                        src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                        alt={p.provider_name}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(ieProviders.buy || []).length > 0 && (
              <div className="provider-row">
                <div className="label">Buy</div>
                <div className="logos">
                  {ieProviders.buy.map((p) => (
                    <a
                      key={`buy-${p.provider_id}`}
                      className="provider-chip"
                      href={providerLink(p.provider_name, title, "IE")}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${p.provider_name}`}
                      aria-label={`Open ${p.provider_name}`}
                    >
                      <img
                        src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                        alt={p.provider_name}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Trailer */}
        {trailer && (
          <section className="card-block glass">
            <h2 className="h5 mb-3">Trailer</h2>
            <div className="trailer-wrapper">
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title={`${title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {/* Top Cast */}
        {cast.length > 0 && (
          <section className="card-block glass">
            <h2 className="h5 mb-3">Top Cast</h2>
            <div className="h-scroll cast-strip">
              {cast.map((p) => (
                <article className="cast-card" key={p.cast_id || p.credit_id}>
                  {p.profile_path ? (
                    <img
                      className="cast-img"
                      src={`https://image.tmdb.org/t/p/w185${p.profile_path}`}
                      alt={p.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="cast-img fallback d-flex align-items-center justify-content-center text-muted">
                      No Photo
                    </div>
                  )}
                  <div className="cast-meta">
                    <div className="name">{p.name}</div>
                    <div className="role text-white">{p.character || "—"}</div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}