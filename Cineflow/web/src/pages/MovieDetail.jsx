// MovieDetail.jsx - Detail page with poster-derived colours - KR 26/08/2025
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchMovieDetail } from "@/api/movies";
import { fetchMyWatchlists, addMovieToWatchlist } from "@/api/watchlists";
import { looksLoggedIn } from "@/api/auth";
import SkeletonRow from "@/components/SkeletonRow.jsx"; // shimmer loaders - KR 26/08/2025
import "@/styles/movie.css";

// util: format 'YYYY-MM-DD' -> 'DD/MM/YYYY' - KR 26/08/2025
const formatDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// map a provider name to a link (home for big 4, otherwise JustWatch search) - KR 26/08/2025
const providerLink = (name, title, region = "IE") => {
  const n = (name || "").toLowerCase();
  if (n.includes("netflix")) return "https://www.netflix.com/";
  if (n.includes("disney")) return "https://www.disneyplus.com/";
  if (n.includes("prime")) return "https://www.primevideo.com/";
  if (n.includes("paramount")) return "https://www.paramountplus.com/";
  // fallback: JustWatch search for this title in the user region - KR 26/08/2025
  const q = encodeURIComponent(title || "");
  return `https://www.justwatch.com/${region.toLowerCase()}/search?q=${q}`;
};

export default function MovieDetail() {
  const { id } = useParams();               // movie TMDB id - KR 26/08/2025
  const [data, setData] = useState(null);   // detail + credits + videos + providers - KR 26/08/2025
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // --- Watchlist UI state ---
  const authed = looksLoggedIn();                              // true if user is logged in
  const [lists, setLists] = useState([]);                      // user's watchlists for the <select>
  const [listsLoading, setListsLoading] = useState(false);     // show a spinner while loading lists
  const [listsError, setListsError] = useState(null);          // store any error text when loading lists

  const [selectedListId, setSelectedListId] = useState("");    // the list id chosen in <select>
  const [saving, setSaving] = useState(false);                 // true while we call backend to save
  const [saveMsg, setSaveMsg] = useState("");                  // success message like “Added!”
  const [saveError, setSaveError] = useState("");              // error message

  // fetch movie detail on mount/id change - KR 26/08/2025
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
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
  if (!authed) return;                                      // only fetch lists if authed is true

  let alive = true;
  setListsLoading(true);
  setListsError(null);

  (async () => {
    try {
      const data = await fetchMyWatchlists();               // GET /api/watchlists/
      if (!alive) return;                                   // ignore late responses
      setLists(data || []);
      // if there is at least one list, preselect it for convenience
      if (data && data.length > 0) {
        setSelectedListId(String(data[0].id));
      }
    } catch (err) {
      if (!alive) return;
      setListsError(err.message || "Failed to load your watchlists.");
    } finally {
      if (alive) setListsLoading(false);                    // stops spinner
    }
  })();

  return () => { alive = false; };                          // cleanup if component unmounts
}, [authed]);

async function handleAddToWatchlist() {
  setSaveMsg("");                                            // clear previous success
  setSaveError("");                                          // clear previous error

  // must pick a list
  if (!selectedListId) {
    setSaveError("Please select a watchlist first.");
    return;
  }

  // build the movie payload from the data we already fetched above
  const moviePayload = {
    id: Number(id),                         // TMDB movie id from the route param (string -> number)
    title: data.title || "",                // title from the loaded movie detail
    poster_path: data.poster_path || "",    // poster from the loaded movie detail
  };

  try {
    setSaving(true);
    await addMovieToWatchlist(selectedListId, moviePayload); // POST /api/watchlists/:id/items/
    setSaveMsg("Added to your watchlist!");
  } catch (err) {
    // backend might return 400 if duplicate, or 404 if wrong list id
    setSaveError(err.message || "Could not add to watchlist.");
  } finally {
    setSaving(false);
  }
}

  // after data loads, ask backend to extract poster palette, then set CSS vars on :root - KR 26/08/2025
  useEffect(() => {
    let active = true;
    const path = data?.poster_path;
    (async () => {
      try {
        if (!path) return;
        const res = await fetch(`/api/movies/poster_palette/?path=/t/p/w500${path}`);
        if (!res.ok) return;
        const { palette = [] } = await res.json();
        const start  = palette[0] ? `rgb(${palette[0].join(",")})` : "rgb(20,20,20)";
        const end    = palette[1] ? `rgb(${palette[1].join(",")})` : "rgb(0,0,0)";
        const accent = palette[2] ? `rgb(${palette[2].join(",")})` : "rgb(35,35,35)";
        if (active) {
          // set on :root so the full-page gradient and chips can use these values - KR 26/08/2025
          const rootStyle = document.documentElement.style;
          rootStyle.setProperty("--movie-bg-start", start);
          rootStyle.setProperty("--movie-bg-end", end);
          rootStyle.setProperty("--movie-accent", accent);
        }
      } catch {
        // swallow; CSS has safe defaults - KR 26/08/2025
      }
    })();
    return () => { active = false; };
  }, [data]);

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
        <Link to="/" className="btn btn-outline-secondary">← Back home</Link>
      </div>
    );
  }

  const {
    title,
    poster_path,
    overview,
    release_date,
    runtime,
    genres = [],
    vote_average,
    vote_count,
    credits = { cast: [], crew: [] },
    videos = { results: [] },
    watch_providers = { results: {} }, // if backend older than providers-normalised - KR 26/08/2025
    providers,                          // preferred (if backend added merged['providers']) - KR 26/08/2025
  } = data;

  // region fallback chain for provider blocks - KR 26/08/2025
  const ieProviders =
    providers ||
    watch_providers.results?.IE ||
    watch_providers.results?.US ||
    {};

  const cast = (credits.cast || []).slice(0, 14); // trim cast strip - KR 26/08/2025
  const trailer = (videos.results || []).find(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );

  // page wrapper for gradient - KR 26/08/2025
  return (
    <div className="movie-page">
      <div className="container py-5">
        <div className="row g-4 align-items-start">
          <div className="col-12 col-md-auto">
            {poster_path ? (
              <img
                className="movie-poster"
                src={`https://image.tmdb.org/t/p/w500${poster_path}`}
                alt={title}
              />
            ) : (
              <div className="movie-poster fallback d-flex align-items-center justify-content-center text-muted">
                No Image
              </div>
            )}
          </div>

          <div className="col">
            <h1 className="movie-title mb-2">{title}</h1>

            {/* Meta chips - KR 26/08/2025 */}
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

            {/* ---- Save to Watchlist UI ---- */}
<div className="card bg-dark p-3 mt-4">
  <h5 className="mb-2">Save to Watchlist</h5>

  {/* If not logged in, prompt to log in */}
  {!authed && (
    <div className="text-muted">
      You need to be logged in to save movies.{" "}
      <a href="/login">Log in</a>
    </div>
  )}

  {/* If logged in, show the selector + button */}
  {authed && (
    <>
      {listsLoading && <div className="text-muted">Loading your lists…</div>}

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
                onChange={(e) => setSelectedListId(e.target.value)}
                disabled={saving}
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
              >
                {saving ? "Adding…" : "Add to Watchlist"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Success / error messages */}
      {saveMsg && <div className="text-success mt-2">{saveMsg}</div>}
      {saveError && <div className="text-danger mt-2">{saveError}</div>}
    </>
  )}
</div>

            {/* Overview - KR 26/08/2025 */}
            <p className="movie-overview">{overview || "No overview available."}</p>

            {/* Primary actions - KR 26/08/2025 */}
            <div className="actions mt-3 d-flex flex-wrap gap-2">
              <Link to="/" className="btn btn-ghost">← Back</Link>
              <button className="btn btn-primary">＋ Watchlist</button>
            </div>
          </div>
        </div>
      </div>

      {/* Content sections - KR 26/08/2025 */}
      <div className="container section-stack">
        {/* Where to Watch (clickable chips) - KR 26/08/2025 */}
        {(ieProviders.flatrate?.length ||
          ieProviders.ads?.length ||
          ieProviders.free?.length ||
          ieProviders.rent?.length ||
          ieProviders.buy?.length) ? (
          <section className="providers-block card-block glass">
            <h2 className="h5 mb-3">Where to Watch</h2>

            {/* Included with subscription - KR 26/08/2025 */}
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

            {/* Ad-supported - KR 26/08/2025 */}
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

            {/* Free - KR 26/08/2025 */}
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

            {/* Rent - KR 26/08/2025 */}
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

            {/* Buy - KR 26/08/2025 */}
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
        ) : null}

        {/* Trailer (YouTube) - KR 26/08/2025 */}
        {trailer ? (
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
        ) : null}

        {/* Top Cast strip - KR 26/08/2025 */}
        {cast.length ? (
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
        ) : null}
      </div>
    </div>
  );
}