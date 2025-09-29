import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchRoom, fetchRoomMembers, fetchRoomMovies,
  addRoomMovie, voteRoomMovie,
} from "@/api/rooms";
import "../styles/room.css";

export default function RoomDetail() {
  const { id } = useParams();
  const roomId = Number(id);

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [tmdbId, setTmdbId] = useState("");
  const [adding, setAdding] = useState(false);

  if (!Number.isFinite(roomId)) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger mb-3">
          Invalid room id in URL. Raw: “{String(id)}”
        </div>
        <Link to="/rooms" className="btn btn-outline-ghost">← Back to Rooms</Link>
      </div>
    );
  }

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
        setMovies(mv || []);
      } catch (e) {
        if (alive) setErr(e.message || "Failed to load room.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [roomId]);

  async function handleQuickAdd(e) {
    e.preventDefault();
    if (!tmdbId.trim() || adding) return;
    try {
      setAdding(true);
      const mv = await addRoomMovie(roomId, { tmdb_id: Number(tmdbId) });
      setMovies((lst) => [...lst, mv]);
      setTmdbId("");
    } catch (e) {
      alert(e.message || "Could not add movie.");
    } finally {
      setAdding(false);
    }
  }

  async function handleVote(mid, value) {
    try {
      await voteRoomMovie(roomId, mid, value);
      const mv = await fetchRoomMovies(roomId);
      setMovies(mv || []);
    } catch (e) {
      alert(e.message || "Vote failed.");
    }
  }

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

      {/* Queue + quick add */}
      <div className="wl-card glass">
        <div className="d-flex align-items-center justify-content-between">
          <h2 className="h6 m-0">Queue</h2>
          <form className="d-flex gap-2" onSubmit={handleQuickAdd}>
            <input
              className="form-control wl-input room-input"
              placeholder="TMDB id…"
              value={tmdbId}
              onChange={(e) => setTmdbId(e.target.value)}
            />
            <button className="btn btn-outline-ghost" disabled={adding || !tmdbId.trim()}>
              {adding ? "Adding…" : "Add"}
            </button>
          </form>
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
                </div>
              </div>
            </div>
          ))}
          {movies.length === 0 && (
            <div className="text-muted p-3">No movies yet. Add a TMDB id above.</div>
          )}
        </div>
      </div>
    </div>
  );
}