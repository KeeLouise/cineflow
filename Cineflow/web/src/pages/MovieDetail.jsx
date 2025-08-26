import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchMovieDetail } from "@/api/movies";
import SkeletonRow from "@/components/SkeletonRow.jsx"; // shimmer loaders - KR 26/08/2025
import "@/styles/movie.css";

// util: format 'YYYY-MM-DD' -> 'DD/MM/YYYY' - KR 26/08/2025
const formatDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export default function MovieDetail() {
  const { id } = useParams();               // movie TMDB id - KR 26/08/2025
  const [data, setData] = useState(null);   // detail + credits + videos + providers - KR 26/08/2025
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
          // set on :root so the full-page gradient uses these values - KR 26/08/2025
          const rootStyle = document.documentElement.style;
          rootStyle.setProperty("--movie-bg-start", start);
          rootStyle.setProperty("--movie-bg-end", end);
          rootStyle.setProperty("--movie-accent", accent);
        }
      } catch {
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
    backdrop_path, // not used as background - KR 26/08/2025
    overview,
    release_date,
    runtime,
    genres = [],
    vote_average,
    vote_count,
    credits = { cast: [], crew: [] },
    videos = { results: [] },
    watch_providers = { results: {} },
  } = data;

  const cast = (credits.cast || []).slice(0, 14); // trim cast strip - KR 26/08/2025
  const trailer = (videos.results || []).find(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );
  
  const ieProviders = data.providers || {};  // has flatrate / ads / free / rent / buy

  return (
    // page wrapper for gradient - KR 26/08/2025
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
                  {genres.map(g => g.name).join(" • ")}
                </span>
              ) : null}
              {vote_average ? (
                <span className="chip rating">
                  ★ {vote_average.toFixed(1)}{" "}
                  <span className="muted">({vote_count?.toLocaleString?.() || 0})</span>
                </span>
              ) : null}
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
        {/* Where to Watch - KR 26/08/2025 */}
        {(ieProviders.flatrate?.length || ieProviders.rent?.length || ieProviders.buy?.length) ? (
          <section className="providers-block card-block">
            <h2 className="h5 mb-3">Where to Watch</h2>

            <div className="provider-row">
              <div className="label">Included</div>
              <div className="logos">
                {(ieProviders.flatrate || []).map((p) => (
                  <div className="provider-chip" key={`f-${p.provider_id}`}>
                    <img
                      src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                      alt={p.provider_name}
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="provider-row">
              <div className="label">Rent</div>
              <div className="logos">
                {(ieProviders.rent || []).map((p) => (
                  <div className="provider-chip" key={`r-${p.provider_id}`}>
                    <img
                      src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                      alt={p.provider_name}
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="provider-row">
              <div className="label">Buy</div>
              <div className="logos">
                {(ieProviders.buy || []).map((p) => (
                  <div className="provider-chip" key={`b-${p.provider_id}`}>
                    <img
                      src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                      alt={p.provider_name}
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Trailer (YouTube) - KR 26/08/2025 */}
        {trailer ? (
          <section className="card-block glass-block">
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
          <section className="card-block glass-block">
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
                    <div className="role text-muted">{p.character || "—"}</div>
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