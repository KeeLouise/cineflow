import React, { useEffect, useMemo, useState } from "react";                                 // react hooks
import { useParams, Link } from "react-router-dom";                                          // read :id from the URL and link back
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
  WATCHED: "watched",
  DROPPED: "dropped",
};

const STATUS_LABEL = {
  planned: "Will Watch",
  watched: "Watched",
  dropped: "Dropped",
};

export default function WatchlistDetail() {
  const { id } = useParams();                                                                // read watchlist id from /watchlists/:id - KR 25/09/2025
  const [wl, setWl] = useState(null);                                                        // current watchlist data - KR 25/09/2025
  const [loading, setLoading] = useState(true);                                              // spinner while loading - KR 25/09/2025
  const [error, setError] = useState("");                                                    // error banner - KR 25/09/2025
  const [filter, setFilter] = useState("all");                                               // UI filter (all/planned/watched/dropped) - KR 25/09/2025
  const [renaming, setRenaming] = useState(false);                                           // inline rename bar - KR 25/09/2025
  const [newName, setNewName] = useState("");                                                

  // Load the watchlist
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchWatchlist(id);                                               
        setWl(data);
        setNewName(data?.name || "");
      } catch (err) {
        setError(err.message || "Failed to load watchlist.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Quick counters for header chips
  const counts = useMemo(() => {
    const items = wl?.items || [];
    const by = { all: items.length, planned: 0, watched: 0, dropped: 0 };
    for (const it of items) {
      const s = it.status || STATUS.PLANNED;
      if (by[s] !== undefined) by[s] += 1;
    }
    return by;
  }, [wl]);

  // Optimistic status change per item
  async function changeStatus(item, next) {
    if (!wl) return;
    const prev = wl;
    setWl((p) => ({
      ...p,
      items: p.items.map((it) => (it.id === item.id ? { ...it, status: next } : it)),
    }));
    try {
      await updateWatchlistItem(wl.id, item.id, { status: next });                           
    } catch (err) {
      // rollback
      setWl(prev);
      setError(err.message || "Failed to update movie status.");
    }
  }

  // Remove an item
  async function removeItem(itemId) {
    if (!wl) return;
    if (!confirm("Remove this movie from the list?")) return;
    const prev = wl;
    setWl((p) => ({ ...p, items: p.items.filter((it) => it.id !== itemId) }));
    try {
      await removeMovieFromWatchlist(wl.id, itemId);
    } catch (err) {
      setWl(prev); // rollback
      setError(err.message || "Failed to remove movie.");
    }
  }

  // Rename the list
  async function saveRename() {
    const name = newName.trim();
    if (!name || !wl) return;
    try {
      const updated = await updateWatchlist(wl.id, { name });
      setWl(updated);
      setRenaming(false);
    } catch (err) {
      setError(err.message || "Rename failed.");
    }
  }

  // Filtering logic
  const visibleItems = useMemo(() => {
    const items = wl?.items || [];
    if (filter === "all") return items;
    return items.filter((it) => (it.status || STATUS.PLANNED) === filter);
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
                <li key={it.id} className="wl-item glass">
                  {/* poster */}
                  <div className="wl-item-poster">
                    {it.poster_path ? (
                      <img
                        src={`${TMDB_IMG}${it.poster_path}`}
                        alt={it.title || "Poster"}
                        loading="lazy"
                      />
                    ) : (
                      <div className="wl-item-noimg">No Image</div>
                    )}
                  </div>

                  {/* middle: title + meta */}
                  <div className="wl-item-main">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <h3 className="wl-item-title mb-0">{it.title}</h3>
                      <span className={`wl-badge ${badgeClass(it.status || STATUS.PLANNED)}`}>
                        {STATUS_LABEL[it.status || STATUS.PLANNED]}
                      </span>
                    </div>
                    <div className="text-muted small mt-1">
                      Added {new Date(it.added_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* right: status control + remove */}
                  <div className="wl-item-actions">
                    <select
                      className="form-select wl-input wl-status-select"
                      value={it.status || STATUS.PLANNED}
                      onChange={(e) => changeStatus(it, e.target.value)}
                    >
                      <option value={STATUS.PLANNED}>{STATUS_LABEL.planned}</option>
                      <option value={STATUS.WATCHED}>{STATUS_LABEL.watched}</option>
                      <option value={STATUS.DROPPED}>{STATUS_LABEL.dropped}</option>
                    </select>
                    <button
                      className="btn btn-ghost btn-compact"
                      onClick={() => changeStatus(it, STATUS.WATCHED)}
                      title="Mark as Watched"
                    >
                      ✓ Watched
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

/* helper components & utils - KR 25/09/2025 */

// Filter pill button
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

// Badge color helper
function badgeClass(status) {
  if (status === "watched") return "wl-badge-success";
  if (status === "dropped") return "wl-badge-dark"; 
  return "";                                        
}