import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchMovieDetail } from "@/api/movies";
import SkeletonRow from "@/components/SkeletonRow.jsx"; // shimmer loaders - KR 26/08/2025

// util: format 'YYYY-MM-DD' -> 'DD/MM/YYYY' - KR 26/08/2025
const formatDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export default function MovieDetail() {
  const { id } = useParams();               // movie TMDB id - KR 26/08/2025
  const [data, setData] = useState(null);   // detail and credits
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
    backdrop_path,
    overview,
    release_date,
    runtime,
    genres = [],
    credits = { cast: [], crew: [] },
  } = data;

  const cast = (credits.cast || []).slice(0, 12); // trim cast strip - KR 26/08/2025

  return (
    <div className="container-fluid movie-hero">
      <div
        className={`movie-hero__backdrop ${backdrop_path ? "has-bg" : ""}`}
        style={backdrop_path ? { backgroundImage: `url(https://image.tmdb.org/t/p/original${backdrop_path})` } : undefined}
        aria-hidden="true"
      />
      <div className="container py-5 position-relative">
        <div className="row g-4">
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

            <div className="movie-meta mb-3">
              <span className="badge text-bg-dark me-2">
                Release Date: {formatDate(release_date)}
              </span>
              {runtime ? (
                <span className="badge text-bg-secondary me-2">
                  {runtime} min
                </span>
              ) : null}
              {genres.length ? (
                <span className="badge text-bg-info">
                  {genres.map(g => g.name).join(" • ")}
                </span>
              ) : null}
            </div>

            <p className="movie-overview">{overview || "No overview available."}</p>

            <div className="d-flex gap-2 mt-3">
              <Link to="/" className="btn btn-outline-light">← Back</Link>
              {/* Placeholder for Watchlist action - KR 26/08/2025 */}
              <button className="btn btn-primary">＋ Watchlist</button>
            </div>
          </div>
        </div>

        {/* Cast strip - KR 26/08/2025 */}
        {cast.length ? (
          <>
            <h2 className="h5 mt-5 mb-3">Top Cast</h2>
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
          </>
        ) : null}
      </div>
    </div>
  );
}