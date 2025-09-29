import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchRoom, fetchRoomMembers, fetchRoomMovies,
  addRoomMovie, voteRoomMovie, removeRoomMovie,
} from "@/api/rooms";
import { searchMovies } from "@/api/movies";   
import "../styles/room.css";

export default function RoomDetail() {
  const { id } = useParams();
  const roomId = Number(id);

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Winning movie - KR 29/09/2025
  const winningMovie = movies.length
  ? movies.reduce((top, mv) => (mv.score ?? 0) > (top.score ?? 0) ? mv : top, movies[0])
  : null;

  // Live search state - KR 29/09/2025
  const [q, setQ] = useState("");                // search query - KR
  const [results, setResults] = useState([]);    // search results list - KR
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);

  // if the URL param isn't a number, show an error immediately - KR
  if (!Number.isFinite(roomId)) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger mb-3">Invalid room id in URL.</div>
        <Link to="/rooms" className="btn btn-outline-ghost">← Back to Rooms</Link>
      </div>
    );
  }

  // Load room details/members/movies - KR 29/09/2025
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [r, mbs, mv] = await Promise.all([
          fetchRoom(roomId),
          fetchRoomMembers(roomId),
          fetchRoomMovies(roomId),
        ]);
        if (!alive) return;
        setRoom(r);
        setMembers(mbs || []);
        // merge: keep any known title/poster locally if API omits them - KR 29/09/2025
        setMovies((prev) => {
          const cache = new Map(prev.map(x => [x.tmdb_id, { title: x.title, poster_path: x.poster_path }]));
          const merged = (mv || []).map(x => ({
            ...x,
            title: x.title || cache.get(x.tmdb_id)?.title || "",
            poster_path: x.poster_path || cache.get(x.tmdb_id)?.poster_path || "",
          }));
          return merged;
        });
      } catch (e) {
        if (alive) setErr(e.message || "Failed to load room.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [roomId]);

 
  // Voting
  async function handleVote(mid, value) {
    try {
      await voteRoomMovie(roomId, mid, value);
      const mv = await fetchRoomMovies(roomId);
      // --- merge after refetch so title/poster never disappear
      setMovies((prev) => {
        const cache = new Map(prev.map(x => [x.tmdb_id, { title: x.title, poster_path: x.poster_path }]));
        const merged = (mv || []).map(x => ({
          ...x,
          title: x.title || cache.get(x.tmdb_id)?.title || "",
          poster_path: x.poster_path || cache.get(x.tmdb_id)?.poster_path || "",
        }));
        return merged;
      });
    } catch (e) {
      alert(e.message || "Vote failed.");
    }
  }

  // Live Search: debounce input then call backend - KR 29/09/2025
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const payload = await searchMovies(query);
        const items = Array.isArray(payload?.results) ? payload.results : [];
        setResults(items.slice(0, 8));
        setShowResults(true);
      } catch {
        setResults([]);
        setShowResults(false);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  // Add from search result - KR 29/09/2025
  async function handleAddFromSearch(movie) {
  try {
    const payload = {
      tmdb_id: Number(movie.id),
      title: movie.title || movie.name || "",
      poster_path: movie.poster_path || "",
    };
    const added = await addRoomMovie(roomId, payload);
    setMovies((lst) => [
      ...lst,
      {
        ...added,
        title: added.title || payload.title,
        poster_path: added.poster_path || payload.poster_path,
      },
    ]);
    setQ("");
    setResults([]);
    setShowResults(false);
  } catch (e) {
    alert(e.message || "Could not add movie.");
  }
}

async function handleRemove(mid) {
  if (!window.confirm("Remove this movie from the room?")) return;
  try {
    await removeRoomMovie(roomId, mid);
    setMovies((lst) => lst.filter((m) => m.id !== mid));
  } catch (e) {
    alert(e.message || "Could not remove movie.");
  }
}

  // Close dropdown when clicking outside - KR
  const searchBoxRef = useRef(null);
  useEffect(() => {
    function onDocClick(e) {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  if (loading) {
    return (
      <div className="container py-4">
        <div className="glass p-4 text-center">Loading…</div>
      </div>
    );
  }
  if (err || !room) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger mb-3">{err || "Not found"}</div>
        <Link to="/rooms" className="btn btn-outline-ghost">← Back to Rooms</Link>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="wl-card glass mb-3">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <h1 className="h4 m-0">{room.name}</h1>
            <span className={`wl-badge ${room.is_active ? "wl-badge-success" : "wl-badge-dark"}`}>
              {room.is_active ? "Active" : "Ended"}
            </span>
          </div>
          <Link to="/rooms" className="btn btn-outline-ghost">← Back</Link>
        </div>
        {room.description ? <p className="mt-2 mb-0 text-muted">{room.description}</p> : null}
      </div>

      {/* Members */}
      <div className="wl-card glass mb-3">
        <h2 className="h6 mb-2">Members</h2>
        <div className="d-flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="wl-badge">
              {m.username}{m.is_host ? " ⭐" : ""}
            </span>
          ))}
        </div>
      </div>

      {/* Winning Movie */}
{winningMovie && (
  <div className="wl-card glass mb-3">
    <h2 className="h6 mb-2">Winning Movie</h2>
    <div className="d-flex align-items-center gap-3">
      {winningMovie.poster_path ? (
        <img
          src={`https://image.tmdb.org/t/p/w154${winningMovie.poster_path}`}
          alt={winningMovie.title || `#${winningMovie.tmdb_id}`}
          className="room-poster-lg"
          loading="lazy"
        />
      ) : (
        <div className="room-poster-placeholder-lg">—</div>
      )}
      <div>
        <div className="fw-bold">{winningMovie.title || `#${winningMovie.tmdb_id}`}</div>
        <div className="text-muted small">Score: {winningMovie.score ?? 0}</div>
      </div>
    </div>
  </div>
)}

      {/* Queue + LIVE SEARCH */}
      <div className="wl-card glass">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h2 className="h6 m-0">Queue</h2>

          {/* Live Search box */}
          <div className="room-search" ref={searchBoxRef}>
            <input
              className="form-control wl-input room-search-input"
              placeholder="Search movies…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => { if (results.length) setShowResults(true); }}
              aria-label="Search movies to add to this room"
            />
            {showResults && (
              <div className="room-results">
                {searching ? (
                  <div className="room-results-item text-muted">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="room-results-item text-muted">No results</div>
                ) : (
                  results.map((mv) => (
                    <button
                      key={mv.id}
                      type="button"
                      className="room-results-item"
                      onClick={() => handleAddFromSearch(mv)}
                    >
                      {mv.poster_path ? (
                        <img
                          className="room-results-thumb"
                          src={`https://image.tmdb.org/t/p/w92${mv.poster_path}`}
                          alt={mv.title || mv.name || ""}
                          loading="lazy"
                        />
                      ) : (
                        <div className="room-results-thumb placeholder">—</div>
                      )}
                      <div className="room-results-meta">
                        <div className="room-results-title">{mv.title || mv.name || ""}</div>
                        <div className="room-results-sub">
                          {mv.release_date ? mv.release_date.slice(0, 4) : "—"}
                        </div>
                      </div>
                      <span className="room-results-add">Add</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Movies grid */}
        <div className="row g-2 mt-2">
          {movies.map((m) => (
            <div key={m.id} className="col-12 col-sm-6 col-lg-4">
              <div className="glass p-2 h-100 d-flex align-items-center gap-2">
                {m.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                    alt={m.title || m.tmdb_id}
                    className="room-poster"
                    loading="lazy"
                  />
                ) : (
                  <div className="room-poster-placeholder">—</div>
                )}

                <div className="flex-grow-1">
                  <div className="fw-bold small">{m.title || `#${m.tmdb_id}`}</div>
                  <div className="text-muted small">Score: {m.score ?? 0}</div>
                </div>

                <div className="d-flex gap-1">
                  <button className="btn btn-ghost btn-compact" title="Upvote" onClick={() => handleVote(m.id, 1)}>▲</button>
                  <button className="btn btn-ghost btn-compact" title="Downvote" onClick={() => handleVote(m.id, -1)}>▼</button>
                  <button className="btn btn-outline-ghost btn-compact" title="Remove" onClick={() => handleRemove(m.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
          {movies.length === 0 && (
            <div className="text-muted p-3">No movies yet. Use the search box above to add one.</div>
          )}
        </div>
      </div>
    </div>
  );
}