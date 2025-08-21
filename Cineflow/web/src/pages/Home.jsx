import React, { useEffect, useState } from "react";
import { fetchTrendingMovies } from "../api/movies";

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrendingMovies()
      .then((data) => setMovies(data.results || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-4">Loading movies…</p>;

  return (
    <div className="p-4">
      <h1 className="mb-4">Trending Movies</h1>
      <div className="row g-4">
        {movies.map((m) => (
          <div key={m.id} className="col-6 col-md-3">
            <div className="card h-100 shadow-sm">
              {m.poster_path && (
                <img
                  className="card-img-top"
                  src={`https://image.tmdb.org/t/p/w500${m.poster_path}`}
                  alt={m.title}
                />
              )}
              <div className="card-body">
                <h6 className="card-title mb-1">{m.title}</h6>
                <small className="text-muted">{m.release_date}</small>
              </div>
            </div>
          </div>
        ))}
        {!movies.length && (
          <div className="text-muted">No movies found.</div>
        )}
      </div>
    </div>
  );
}