import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchRoom,
  fetchRoomMembers,
  fetchRoomMovies,
  addRoomMovie,
  voteRoomMovie,
  deleteRoomMovie,
} from "@/api/rooms";
import { searchMovies } from "@/api/movies";
import { mediaUrl } from "@/utils/media";
import { getMyProfile } from "@/api/profile";
import "../styles/room.css";

export default function RoomDetail() {
  const { id } = useParams();
  const roomId = Number(id);

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [me, setMe] = useState(null);

  // Live search
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);
  const searchBoxRef = useRef(null);

  // Guard invalid id
  if (!Number.isFinite(roomId)) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger mb-3">Invalid room id in URL.</div>
        <Link to="/rooms" className="btn btn-outline-ghost">← Back to Rooms</Link>
      </div>
    );
  }

  // Load room + members + movies + profile
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [r, mbs, mv, meProfile] = await Promise.all([
          fetchRoom(roomId),
          fetchRoomMembers(roomId),
          fetchRoomMovies(roomId),
          getMyProfile().catch(() => null),
        ]);
        if (!alive) return;
        setRoom(r || null);
        setMembers(Array.isArray(mbs) ? mbs : []);
        setMovies(Array.isArray(mv) ? mv : []);
        setMe(meProfile || null);
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load room.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [roomId]);

  // Vote
  async function handleVote(mid, value) {
    try {
      await voteRoomMovie(roomId, mid, value);
      const mv = await fetchRoomMovies(roomId);
      setMovies(Array.isArray(mv) ? mv : []);
    } catch (e) {
      alert(e?.message || "Vote failed.");
    }
  }

  // Remove
  async function handleRemove(mid) {
    if (!confirm("Remove this movie from the room?")) return;
    try {
      await deleteRoomMovie(roomId, mid);
      setMovies((lst) => (Array.isArray(lst) ? lst.filter((m) => m.id !== mid) : []));
    } catch (e) {
      alert(e?.message || "Could not remove movie.");
    }
  }

  // Debounced search
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

  // Add movie
  async function handleAddFromSearch(movie) {
    try {
      const payload = {
        tmdb_id: Number(movie?.id),
        title: movie?.title || movie?.name || "",
        poster_path: movie?.poster_path || "",
      };
      const added = await addRoomMovie(roomId, payload);
      setMovies((lst) => (Array.isArray(lst) ? [...lst, added] : [added]));
      setQ("");
      setResults([]);
      setShowResults(false);
    } catch (e) {
      alert(e?.message || "Could not add movie.");
    }
  }

  // Close dropdown
  useEffect(() => {
    function onDocClick(e) {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(e.target)) setShowResults(false);
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

  // Safe lists everywhere
  const safeMovies = Array.isArray(movies) ? movies : [];
  const safeMembers = Array.isArray(members) ? members : [];
  const safeResults = Array.isArray(results) ? results : [];

  // Top 3
  const top3 = safeMovies
    .map((m) => ({ ...m, score: Number.isFinite(m?.score) ? m.score : 0 }))
    .sort(
      (a, b) =>
        (b.score - a.score) ||
        ((a?.position ?? 0) - (b?.position ?? 0)) ||
        (new Date(b?.added_at || 0) - new Date(a?.added_at || 0))
    )
    .slice(0, 3);

  // Is current user the host?
  const isCurrentUserHost = !!(
    me &&
    safeMembers.some((m) => m?.is_host && m?.username && m.username === me.username)
  );

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(String(room?.invite_code || ""));
      const el = document.getElementById("invite-copy-chip");
      if (el) {
        el.dataset.copied = "1";
        setTimeout(() => { el.dataset.copied = "0"; }, 1200);
      }
    } catch {
      alert("Could not copy invite code.");
    }
  }

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="wl-card glass mb-3 room-header">
        <div className="room-header-row">
          <div className="room-header-left">
            <h1 className="h4 m-0">{room?.name || "Room"}</h1>
            <span className={`wl-badge ${room?.is_active ? "wl-badge-success" : "wl-badge-dark"}`}>
              {room?.is_active ? "Active" : "Ended"}
            </span>

            {/* Host invite chip */}
            {isCurrentUserHost && room?.invite_code ? (
              <button
                id="invite-copy-chip"
                type="button"
                className="wl-badge invite-chip"
                onClick={copyInvite}
                title="Copy invite code"
              >
                Invite: <span className="invite-code">{room.invite_code}</span>
                <span className="invite-icon">⧉</span>
              </button>
            ) : null}
          </div>
          <Link to="/rooms" className="btn btn-outline-ghost">← Back</Link>
        </div>
        {room?.description ? <p className="mt-2 mb-0 text-muted">{room.description}</p> : null}
      </div>

      <div className="room-grid two-col">
        {/* Members + Top3 */}
        <section className="glass room-panel">
          <div className="room-panel-head">
            <h2 className="h6 m-0">Members</h2>
          </div>
          <div className="room-members">
            {safeMembers.map((m) => (
              <div key={m?.id ?? `mem-${m?.username ?? Math.random()}`} className="member-chip">
                {m?.avatar ? (
                  <img className="member-avatar" src={mediaUrl(m.avatar)} alt={m?.username || "user"} />
                ) : (
                  <div className="member-avatar member-initial">
                    {(m?.username?.[0] || "?").toUpperCase()}
                  </div>
                )}
                <span className="wl-badge">{m?.is_host ? "Host" : "Member"}</span>
              </div>
            ))}
            {safeMembers.length === 0 && <div className="text-muted small">No members</div>}
          </div>

          <div className="glass top3-card mt-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-semibold">Top 3</span>
              <span className="text-muted small">by votes</span>
            </div>
            <ul className="top3-list">
              {top3.length > 0 ? (
                top3.map((m, i) => (
                  <li key={m?.id ?? `top-${i}`} className="top3-item">
                    <div className="top3-rank">{i + 1}</div>
                    {m?.poster_path ? (
                      <img
                        className="top3-thumb"
                        src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                        alt={m?.title || `#${m?.tmdb_id ?? ""}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="top3-thumb placeholder">—</div>
                    )}
                    <div className="top3-meta">
                      <div className="top3-title">{m?.title || `#${m?.tmdb_id ?? ""}`}</div>
                      <div className="top3-sub">Score: {m?.score ?? 0}</div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-muted small">No votes yet.</li>
              )}
            </ul>
          </div>
        </section>

        {/* Queue + Search in the same card */}
        <section className="glass room-panel">
          <div className="room-panel-head">
            <h2 className="h6 m-0">Queue</h2>
          </div>

          {/* Search box */}
          <div className="room-search mb-3" ref={searchBoxRef}>
            <input
              className="form-control wl-input room-search-input"
              placeholder="Search movies…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => { if (safeResults.length) setShowResults(true); }}
              aria-label="Search movies to add to this room"
            />
            {showResults && (
              <div className="room-results">
                {searching ? (
                  <div className="room-results-item text-muted">Searching…</div>
                ) : safeResults.length === 0 ? (
                  <div className="room-results-item text-muted">No results</div>
                ) : (
                  safeResults.map((mv) => (
                    <button
                      key={mv?.id ?? Math.random()}
                      type="button"
                      className="room-results-item"
                      onClick={() => handleAddFromSearch(mv)}
                    >
                      {mv?.poster_path ? (
                        <img
                          className="room-results-thumb"
                          src={`https://image.tmdb.org/t/p/w92${mv.poster_path}`}
                          alt={mv?.title || mv?.name || ""}
                          loading="lazy"
                        />
                      ) : (
                        <div className="room-results-thumb placeholder">—</div>
                      )}
                      <div className="room-results-meta">
                        <div className="room-results-title">{mv?.title || mv?.name || ""}</div>
                        <div className="room-results-sub">
                          {mv?.release_date ? String(mv.release_date).slice(0, 4) : "—"}
                        </div>
                      </div>
                      <span className="room-results-add">Add</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Movies list */}
          <div className="room-list">
            {(Array.isArray(movies) ? movies : []).map((m) => (
              <div key={m?.id ?? `rm-${m?.tmdb_id ?? Math.random()}`} className="room-item glass">
                {m?.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                    alt={m?.title || String(m?.tmdb_id || "")}
                    className="room-poster"
                    loading="lazy"
                  />
                ) : (
                  <div className="room-poster-placeholder">—</div>
                )}

                <div className="room-item-main">
                  <div className="room-item-title">{m?.title || `#${m?.tmdb_id ?? ""}`}</div>
                  <div className="room-item-sub">Score: {m?.score ?? 0}</div>
                </div>

                <div className="room-item-actions">
                  <button
                    className="btn btn-ghost btn-compact"
                    title="Upvote"
                    onClick={() => handleVote(m?.id, 1)}
                  >
                    ▲
                  </button>
                  <button
                    className="btn btn-ghost btn-compact"
                    title="Downvote"
                    onClick={() => handleVote(m?.id, -1)}
                  >
                    ▼
                  </button>
                  <button
                    className="btn btn-outline-ghost btn-compact link-danger"
                    title="Remove"
                    onClick={() => m?.id && handleRemove(m.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {(Array.isArray(movies) ? movies : []).length === 0 && (
              <div className="text-muted p-3">No movies yet. Use the search box above to add one.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}