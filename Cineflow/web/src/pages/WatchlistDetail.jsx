import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchWatchlist,
  updateWatchlistItem,
  removeMovieFromWatchlist,
  updateWatchlist,
} from "@/api/watchlists";
import "@/styles/watchlists.css";

const TMDB_IMG = "https://image.tmdb.org/t/p/w154";

const STATUS = {
  PLANNED: "planned",
  WATCHING: "watching",
  WATCHED: "watched",
  DROPPED: "dropped",
};

const STATUS_LABEL = {
  planned: "Will Watch",
  watching: "Watching",
  watched: "Watched",
  dropped: "Dropped",
};

// Build auth header for local fetches on this page
function authHeaders() {
  const token = localStorage.getItem("access");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Persist a new item order
async function persistOrder(listId, orderedIds) {
  try {
    const res = await fetch(`/api/watchlists/${listId}/reorder/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ order: orderedIds }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return data || null;
    }
  } catch {}
  return null;
}

function posterUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${TMDB_IMG}${clean}`;
}

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default function WatchlistDetail() {
  const { id } = useParams();
  const listId = Number(id);
  const [wl, setWl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  // drag handling
  const [draggingId, setDraggingId] = useState(null);
  const lastOverRef = useRef(null);

  function reorderLocal(srcId, targetId) {
    setWl((prev) => {
      if (!prev) return prev;
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      const fromIdx = items.findIndex((i) => i.id === srcId);
      const toIdx = items.findIndex((i) => i.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return { ...prev, items };
    });
  }

  async function commitOrder() {
    if (!wl) return;
    const ids = (Array.isArray(wl.items) ? wl.items : []).map((i) => i.id);
    if (!ids.length) return;
    const data = await persistOrder(wl.id, ids);
    if (data && data.items) setWl(data);
  }

  function onDragStart(itemId) {
    setDraggingId(itemId);
    lastOverRef.current = null;
  }
  function onDragOver(e, overId) {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    if (lastOverRef.current === overId) return;
    lastOverRef.current = overId;
    reorderLocal(draggingId, overId);
  }
  async function onDrop() {
    setDraggingId(null);
    lastOverRef.current = null;
    await commitOrder();
  }

  useEffect(() => {
    let alive = true;

    if (!Number.isFinite(listId)) {
      setLoading(false);
      setError("Invalid watchlist id.");
      setWl(null);
      return () => {};
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchWatchlist(listId);
        if (!alive) return;
        setWl(data || null);
        setNewName(data?.name || "");
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Failed to load watchlist.");
        setWl(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [listId]);

  const counts = useMemo(() => {
    const items = Array.isArray(wl?.items) ? wl.items : [];
    const by = { all: items.length, planned: 0, watching: 0, watched: 0, dropped: 0 };
    for (const it of items) {
      const s = it?.status || STATUS.PLANNED;
      if (by[s] !== undefined) by[s] += 1;
    }
    return by;
  }, [wl]);

  async function changeStatus(item, next) {
    if (!wl) return;
    const current = item?.status || STATUS.PLANNED;
    if (current === next) return;
    const prev = wl;
    setWl((p) => ({
      ...p,
      items: (Array.isArray(p.items) ? p.items : []).map((it) =>
        it.id === item.id ? { ...it, status: next } : it
      ),
    }));
    try {
      await updateWatchlistItem(wl.id, item.id, { status: next });
    } catch (err) {
      setWl(prev); // rollback
      setError(err?.message || "Failed to update movie status.");
    }
  }

  async function removeItem(itemId) {
    if (!wl) return;
    if (!confirm("Remove this movie from the list?")) return;
    const prev = wl;
    setWl((p) => ({
      ...p,
      items: (Array.isArray(p.items) ? p.items : []).filter((it) => it.id !== itemId),
    }));
    try {
      await removeMovieFromWatchlist(wl.id, itemId);
    } catch (err) {
      setWl(prev);
      setError(err?.message || "Failed to remove movie.");
    }
  }

  async function saveRename() {
    const name = newName.trim();
    if (!name || !wl) return;
    try {
      const updated = await updateWatchlist(wl.id, { name });
      setWl(updated || wl);
      setRenaming(false);
    } catch (err) {
      setError(err?.message || "Rename failed.");
    }
  }

  const visibleItems = useMemo(() => {
    const items = Array.isArray(wl?.items) ? wl.items : [];
    if (filter === "all") return items;
    return items.filter((it) => (it?.status || STATUS.PLANNED) === filter);
  }, [wl, filter]);

  if (loading) {
    return (
      <div className="watchlists-page container py-5 d-flex justify-content-center">
        <div className="spinner-border spinner-lg" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (!wl) {
    return (
      <div className="watchlists-page container py-5">
        {error ? <div className="alert alert-danger glass">{error}</div> : <p>Watchlist not found.</p>}
        <Link to="/watchlists" className="btn btn-outline-ghost mt-3">Back to My Watchlists</Link>
      </div>
    );
  }

  return (
    <div className="watchlists-page">
      {/* Header */}
      <header className="wl-hero">
        <div className="container d-flex flex-wrap align-items-end justify-content-between gap-2">
          <div>
            {!renaming ? (
              <>
                <h1 className="wl-title mb-1">{wl.name}</h1>
                <p className="wl-subtitle mb-0">
                  {counts.all} {counts.all === 1 ? "movie" : "movies"} · {wl.is_public ? "Public" : "Private"}
                </p>
              </>
            ) : (
              <div className="d-flex gap-2 align-items-center">
                <input
                  className="form-control wl-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={120}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newName.trim()) saveRename();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setRenaming(false);
                      setNewName(wl?.name || "");
                    }
                  }}
                />
                <button className="btn btn-success btn-compact" onClick={saveRename} disabled={!newName.trim()}>
                  Save
                </button>
                <button className="btn btn-ghost btn-compact" onClick={() => setRenaming(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="d-flex gap-2">
            {!renaming && (
              <button className="btn btn-ghost btn-compact" onClick={() => setRenaming(true)}>
                Rename
              </button>
            )}
            <Link to="/watchlists" className="btn btn-outline-ghost">Back</Link>
          </div>
        </div>
      </header>

      <div className="container py-4 pb-5">
        {error && <div className="alert alert-danger glass mb-3">{error}</div>}

        {/* Filter bar */}
        <div className="glass p-2 d-flex align-items-center gap-2 flex-wrap">
          <FilterPill label={`All (${counts.all})`} active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterPill label={`Will Watch (${counts.planned})`} active={filter === STATUS.PLANNED} onClick={() => setFilter(STATUS.PLANNED)} />
          <FilterPill label={`Watching (${counts.watching})`} active={filter === STATUS.WATCHING} onClick={() => setFilter(STATUS.WATCHING)} />
          <FilterPill label={`Watched (${counts.watched})`} active={filter === STATUS.WATCHED} onClick={() => setFilter(STATUS.WATCHED)} />
          <FilterPill label={`Dropped (${counts.dropped})`} active={filter === STATUS.DROPPED} onClick={() => setFilter(STATUS.DROPPED)} />
        </div>

        {/* Items list */}
        {visibleItems.length === 0 ? (
          <div className="wl-empty glass text-center mt-3">
            <div className="wl-empty-emoji">🎬</div>
            <h3 className="mt-2 mb-1">Nothing here yet</h3>
            <p className="text-muted mb-0">Try switching filters, or add some films to this list.</p>
          </div>
        ) : (
          <div className="mt-3">
            <ul className="wl-items list-unstyled m-0">
              {visibleItems.map((it) => (
                <li
                  key={it.id}
                  className="wl-item glass"
                  draggable={filter === "all"}
                  onDragStart={() => onDragStart(it.id)}
                  onDragOver={(e) => (filter === "all" ? onDragOver(e, it.id) : null)}
                  onDrop={() => (filter === "all" ? onDrop() : null)}
                  onDragEnd={() => (filter === "all" ? onDrop() : null)}
                >
                  {/* poster */}
                  <div className="wl-item-poster">
                    {it.poster_path ? (
                      <img src={posterUrl(it.poster_path)} alt={it.title || "Poster"} loading="lazy" />
                    ) : (
                      <div className="wl-item-noimg">No Image</div>
                    )}
                  </div>

                  {/* middle: title + meta */}
                  <div className="wl-item-main">
                    {filter === "all" && (
                      <div className="wl-item-handle text-muted small mb-1" title="Drag to reorder" aria-hidden="true">
                        ⋮⋮
                      </div>
                    )}
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <h3 className="wl-item-title mb-0">{it.title}</h3>
                      <span className={`wl-badge ${badgeClass(it.status || STATUS.PLANNED)}`}>
                        {STATUS_LABEL[it.status || STATUS.PLANNED]}
                      </span>
                    </div>
                    <div className="text-muted small mt-1">Added {formatDate(it.added_at)}</div>
                  </div>

                  {/* right: status control + remove */}
                  <div className="wl-item-actions">
                    <select
                      className="form-select wl-input wl-status-select"
                      value={it.status || STATUS.PLANNED}
                      onChange={(e) => changeStatus(it, e.target.value)}
                    >
                      <option value={STATUS.PLANNED}>{STATUS_LABEL.planned}</option>
                      <option value={STATUS.WATCHING}>{STATUS_LABEL.watching}</option>
                      <option value={STATUS.WATCHED}>{STATUS_LABEL.watched}</option>
                      <option value={STATUS.DROPPED}>{STATUS_LABEL.dropped}</option>
                    </select>
                    <button
                      className="btn btn-ghost btn-compact"
                      onClick={() => changeStatus(it, STATUS.WATCHED)}
                      title="Mark as Watched"
                    >
                      Watched
                    </button>
                    <button
                      className="btn btn-danger btn-compact"
                      onClick={() => removeItem(it.id)}
                      title="Remove from list"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`wl-pill ${active ? "wl-pill--active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function badgeClass(status) {
  if (status === STATUS.WATCHED) return "wl-badge-success";
  if (status === STATUS.WATCHING) return "wl-badge-info";
  if (status === STATUS.DROPPED) return "wl-badge-dark";
  return "";
}