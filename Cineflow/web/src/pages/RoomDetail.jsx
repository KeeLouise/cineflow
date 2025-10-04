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
import "@/styles/room.css";

export default function RoomDetail() {
  const { id } = useParams();
  const roomId = Number(id);

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [me, setMe] = useState(null);

  // per-user vote memory
  const [myVotes, setMyVotes] = useState({});

  // Live search
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);
  const searchBoxRef = useRef(null);

  // themed body
  useEffect(() => {
    document.body.classList.add("rooms-screen");
    return () => document.body.classList.remove("rooms-screen");
  }, []);

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

        // initialize myVotes
        const initialVotes = {};
        (Array.isArray(mv) ? mv : []).forEach((m) => {
          if (typeof m?.my_vote === "number") initialVotes[m.id] = Math.sign(m.my_vote);
        });
        setMyVotes(initialVotes);

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
    if (!mid || ![-1, 0, 1].includes(value)) return;
    setMyVotes((prev) => ({ ...prev, [mid]: value }));

    // soft score bump on UI
    setMovies((prev) => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      const i = arr.findIndex((x) => x?.id === mid);
      if (i >= 0) {
        const current = arr[i];
        const prevVote = myVotes[mid] ?? current?.my_vote ?? 0;
        const delta = value - (prevVote || 0);
        const nextScore = (Number(current?.score) || 0) + delta;
        arr[i] = { ...current, score: nextScore, my_vote: value };
      }
      return arr;
    });

    try {
      await voteRoomMovie(roomId, mid, value);
      const mv = await fetchRoomMovies(roomId);
      setMovies(Array.isArray(mv) ? mv : []);
      // refresh myVotes from server if present
      const refreshed = {};
      (Array.isArray(mv) ? mv : []).forEach((m) => {
        if (typeof m?.my_vote === "number") refreshed[m.id] = Math.sign(m.my_vote);
      });
      setMyVotes(refreshed);
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
      setMyVotes((prev) => {
        const n = { ...prev };
        delete n[mid];
        return n;
      });
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

  // Close dropdown when clicking outside
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

  const safeMovies = Array.isArray(movies) ? movies : [];
  const safeMembers = Array.isArray(members) ? members : [];
  const safeResults = Array.isArray(results) ? results : [];

  const top3 = safeMovies
    .map((m) => ({ ...m, score: Number.isFinite(m?.score) ? m.score : 0 }))
    .sort(
      (a, b) =>
        (b.score - a.score) ||
        ((a?.position ?? 0) - (b?.position ?? 0)) ||
        (new Date(b?.added_at || 0) - new Date(a?.added_at || 0))
    )
    .slice(0, 3);

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
      <div className="glass mb-3 room-header">
        <div className="room-header-row">
          <div className="room-header-left">
            <h1 className="h1 m-0">{room?.name || "Room"}</h1>
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
        {room?.description ? <p className="mt-2 mb-0 subtitle">{room.description}</p> : null}
      </div>

      <div className="room-grid two-col">
        {/* Members + Top3 */}
        <section className="glass room-panel">
          <div className="room-panel-head">
            <h2 className="h2 m-0">Members</h2>
          </div>
          <div className="room-members">
            {safeMembers.map((m) => {
              const avatarSrc = m?.avatar ? `${mediaUrl(m.avatar)}?v=${Date.now()}` : null;
              return (
                <div key={m?.id ?? `mem-${m?.username ?? Math.random()}`} className="member-chip">
                  {avatarSrc ? (
                    <img className="member-avatar" src={avatarSrc} alt={m?.username || "user"} />
                  ) : (
                    <div className="member-avatar member-initial">
                      {(m?.username?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                  <span className="small">{m?.username || "user"}</span>
                  <span className="wl-badge">{m?.is_host ? "Host" : "Member"}</span>
                </div>
              );
            })}
            {safeMembers.length === 0 && <div className="small">No members</div>}
          </div>

          <div className="glass top3-card mt-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-semibold">Top 3</span>
              <span className="small">by votes</span>
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
                <li className="small">No votes yet.</li>
              )}
            </ul>
          </div>
        </section>

        {/* Queue + Search */}
        <section className="glass room-panel">
          <div className="room-panel-head">
            <h2 className="h2 m-0">Queue</h2>
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
                  <div className="room-results-item subtitle">Searching…</div>
                ) : safeResults.length === 0 ? (
                  <div className="room-results-item subtitle">No results</div>
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
            {safeMovies.map((m) => {
              const vote = myVotes[m.id] ?? (typeof m?.my_vote === "number" ? Math.sign(m.my_vote) : 0);
              return (
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
                    <div className="room-item-sub">
                      Score: <strong>{m?.score ?? 0}</strong>
                      {vote !== 0 && (
                        <span className={`vote-flag ${vote > 0 ? "up" : "down"}`}>
                          {vote > 0 ? "Voted ↑" : "Voted ↓"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="room-item-actions">
                    <div className="vote-group" role="group" aria-label="Vote">
                      <button
                        className={`vote-btn vote-btn--up ${vote > 0 ? "is-active" : ""}`}
                        title="Upvote"
                        aria-pressed={vote > 0 ? "true" : "false"}
                        onClick={() => m?.id && handleVote(m.id, vote > 0 ? 0 : 1)}
                      >
                        {/* Thumb up icon */}
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 21h4V9H2v12zM22 10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13 1 6.59 7.41C6.22 7.78 6 8.3 6 8.83V19c0 1.1.9 2 2 2h8c.82 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
                        </svg>
                        <span className="btn-label">Upvote</span>
                      </button>
                      <button
                        className={`vote-btn vote-btn--down ${vote < 0 ? "is-active" : ""}`}
                        title="Downvote"
                        aria-pressed={vote < 0 ? "true" : "false"}
                        onClick={() => m?.id && handleVote(m.id, vote < 0 ? 0 : -1)}
                      >
                        {/* Thumb down icon */}
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M15 3H7c-.82 0-1.54.5-1.84 1.22L2.14 11.27c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L11 23l6.41-6.41c.37-.37.59-.89.59-1.42V5c0-1.1-.9-2-2-2zm6 0h-4v12h4V3z"/>
                        </svg>
                        <span className="btn-label">Down</span>
                      </button>
                    </div>

                    <button
                      className="btn btn-outline-ghost btn-compact link-danger"
                      title="Remove"
                      onClick={() => m?.id && handleRemove(m.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            {safeMovies.length === 0 && (
              <div className="subtitle p-3">No movies yet. Use the search box above to add one.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}