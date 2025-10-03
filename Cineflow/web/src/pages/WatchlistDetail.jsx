import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchWatchlist,
  updateWatchlistItem,
  removeMovieFromWatchlist,
  updateWatchlist,
  addMovieToWatchlist,       
} from "@/api/watchlists";
import { searchMovies } from "@/api/movies"; 
import "@/styles/watchlists.css";

const TMDB_IMG_SMALL = "https://image.tmdb.org/t/p/w154";
const TMDB_IMG_TINY  = "https://image.tmdb.org/t/p/w92";

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

function posterUrl(path, tiny = false) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${tiny ? TMDB_IMG_TINY : TMDB_IMG_SMALL}${clean}`;
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

  // Filter/search within this list
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Rename list
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  // Drag to reorder
  const [draggingId, setDraggingId] = useState(null);
  const lastOverRef = useRef(null);

  // --- Live Add: external search (TMDB) ---
  const [addQuery, setAddQuery] = useState("");
  const [addDebounced, setAddDebounced] = useState("");
  const [addResults, setAddResults] = useState([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Debounce local filter
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Debounce external search
  useEffect(() => {
    const t = setTimeout(() => setAddDebounced(addQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [addQuery]);

  // Fetch list
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

  // Live TMDB search when typing "Add movies…"
  useEffect(() => {
    let active = true;
    setAddError("");

    const q = addDebounced;
    if (!q || q.length < 2) {
      setAddResults([]);
      setAddLoading(false);
      return () => {};
    }

    (async () => {
      setAddLoading(true);
      try {
        const data = await searchMovies(q);
        if (!active) return;
        setAddResults(Array.isArray(data?.results) ? data.results.slice(0, 10) : []);
      } catch (e) {
        if (!active) return;
        setAddResults([]);
        setAddError("Search failed. Try again.");
      } finally {
        if (active) setAddLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [addDebounced]);

  // Counts for pills
  const counts = useMemo(() => {
    const items = Array.isArray(wl?.items) ? wl.items : [];
    const by = { all: items.length, planned: 0, watching: 0, watched: 0, dropped: 0 };
    for (const it of items) {
      const s = it?.status || STATUS.PLANNED;
      if (by[s] !== undefined) by[s] += 1;
    }
    return by;
  }, [wl]);

  // Change status
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
      setWl(prev);
      setError(err?.message || "Failed to update movie status.");
    }
  }

  // Remove item
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

  // Rename list
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

  // Reorder helpers
  function onDragStart(itemId) {
    setDraggingId(itemId);
    lastOverRef.current = null;
  }
  function onDragOver(e, overId) {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    if (lastOverRef.current === overId) return;
    lastOverRef.current = overId;
    setWl((prev) => {
      if (!prev) return prev;
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      const fromIdx = items.findIndex((i) => i.id === draggingId);
      const toIdx = items.findIndex((i) => i.id === overId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return { ...prev, items };
    });
  }
  async function onDrop() {
    setDraggingId(null);
    lastOverRef.current = null;
    if (!wl) return;
    const ids = (Array.isArray(wl.items) ? wl.items : []).map((i) => i.id);
    try {
      await fetch(`/api/watchlists/${wl.id}/reorder/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: ids }),
      });
    } catch {
    }
  }

  // filter + in-list search
  const visibleItems = useMemo(() => {
    const items = Array.isArray(wl?.items) ? wl.items : [];
    const statusFiltered =
      filter === "all" ? items : items.filter((it) => (it?.status || STATUS.PLANNED) === filter);
    if (!debounced) return statusFiltered;
    return statusFiltered.filter((it) => (it?.title || "").toLowerCase().includes(debounced));
  }, [wl, filter, debounced]);

  // Add a movie from search results
  async function handleAddMovie(m) {
    if (!wl || !m?.id) return;
    setAddError("");


    const exists = (wl.items || []).some((it) => it.id === m.id);
    if (exists) {
      setAddError("That title is already in this list.");
      return;
    }

    const payload = {
      id: Number(m.id),
      title: m.title || "",
      poster_path: m.poster_path || "",
    };

    try {

      setWl((prev) => ({
        ...prev,
        items: [
          {
            id: payload.id,
            title: payload.title,
            poster_path: payload.poster_path,
            status: STATUS.PLANNED,
            added_at: new Date().toISOString(),
          },
          ...(prev.items || []),
        ],
      }));

      await addMovieToWatchlist(wl.id, payload);
      setAddQuery("");
      setAddResults([]);
    } catch (e) {
      setWl((prev) => ({
        ...prev,
        items: (prev.items || []).filter((it) => it.id !== payload.id),
      }));
      setAddError(e?.message || "Could not add movie.");
    }
  }

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
                  {wl.items?.length || 0} {(wl.items?.length === 1 ? "movie" : "movies")}
                </p>
                <p className="wl-hint mt-2 mb-0">
                  Tip: drag and drop rows to reorder your list (desktop).
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

        {/* in-list search + filters + live add */}
        <div className="glass wl-toolbar">
          {/*  in-list search */}
          <div className="wl-search">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 001.57-4.23C15.99 6.01 12.98 3 9.5 3S3 6.01 3 9.5 6.01 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4.25 4.25 1.49-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              type="search"
              className="wl-input"
              placeholder="Search in this list…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search titles in this watchlist"
            />
            {query && (
              <button
                type="button"
                className="btn btn-ghost btn-compact wl-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                title="Clear"
              >
                ×
              </button>
            )}
          </div>

          {/* filter pills */}
          <div className="wl-filter-pills">
            <FilterPill label={`All (${counts.all})`} active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterPill label={`Will Watch (${counts.planned})`} active={filter === STATUS.PLANNED} onClick={() => setFilter(STATUS.PLANNED)} />
            <FilterPill label={`Watching (${counts.watching})`} active={filter === STATUS.WATCHING} onClick={() => setFilter(STATUS.WATCHING)} />
            <FilterPill label={`Watched (${counts.watched})`} active={filter === STATUS.WATCHED} onClick={() => setFilter(STATUS.WATCHED)} />
            <FilterPill label={`Dropped (${counts.dropped})`} active={filter === STATUS.DROPPED} onClick={() => setFilter(STATUS.DROPPED)} />
          </div>

          {/*Add movies live search */}
          <div className="wl-add">
            <div className="wl-add-inputwrap">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path fill="currentColor" d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/>
              </svg>
              <input
                type="search"
                className="wl-input wl-add-input"
                placeholder="Add movies… type to search"
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                aria-label="Search movies to add"
              />
              {addQuery && (
                <button
                  type="button"
                  className="btn btn-ghost btn-compact wl-search-clear"
                  onClick={() => { setAddQuery(""); setAddResults([]); setAddError(""); }}
                  title="Clear"
                  aria-label="Clear add search"
                >
                  ×
                </button>
              )}
            </div>

            {/* Results dropdown */}
            {(addQuery.length >= 2) && (
              <div className="wl-add-results">
                {addLoading && <div className="wl-add-row muted">Searching…</div>}
                {addError && !addLoading && <div className="wl-add-row error">{addError}</div>}
                {!addLoading && !addError && addResults.length === 0 && (
                  <div className="wl-add-row muted">No results</div>
                )}

                {addResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="wl-add-row"
                    onClick={() => handleAddMovie(m)}
                    title="Add to this watchlist"
                  >
                    {m.poster_path ? (
                      <img
                        className="wl-add-thumb"
                        src={posterUrl(m.poster_path, true)}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <div className="wl-add-thumb empty">—</div>
                    )}
                    <div className="wl-add-meta">
                      <div className="wl-add-title">{m.title}</div>
                      <div className="wl-add-sub">
                        {(m.release_date || "").slice(0, 4) || "—"}
                        {typeof m.vote_average === "number" ? ` · ★ ${m.vote_average.toFixed(1)}` : ""}
                      </div>
                    </div>
                    <span className="wl-add-action">Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items list */}
        {visibleItems.length === 0 ? (
          <div className="wl-empty glass text-center mt-3">
            <div className="wl-empty-emoji">🎬</div>
            <h3 className="mt-2 mb-1">Nothing here</h3>
            <p className="text-muted mb-0">
              {debounced
                ? "No titles match your search."
                : "Try switching filters, or add some films to this list."}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <ul className="wl-items list-unstyled m-0">
              {visibleItems.map((it) => (
                <li
                  key={it.id}
                  className={`wl-item glass ${draggingId === it.id ? "dragging" : ""}`}
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
                      <div className="wl-item-handle" title="Drag to reorder" aria-hidden="true">
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

                  {/*status control + actions */}
                  <div className="wl-item-actions">
                    <select
                      className="form-select wl-input wl-status-select"
                      value={it.status || STATUS.PLANNED}
                      onChange={(e) => changeStatus(it, e.target.value)}
                      aria-label="Change movie status"
                    >
                      <option value={STATUS.PLANNED}>{STATUS_LABEL.planned}</option>
                      <option value={STATUS.WATCHING}>{STATUS_LABEL.watching}</option>
                      <option value={STATUS.WATCHED}>{STATUS_LABEL.watched}</option>
                      <option value={STATUS.DROPPED}>{STATUS_LABEL.dropped}</option>
                    </select>

                    <button
                      className="btn btn-ghost btn-compact btn-icon"
                      onClick={() => changeStatus(it, STATUS.WATCHED)}
                      title="Mark as Watched"
                      aria-label="Mark as Watched"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7zm0 2C8.1 7 4.9 9.8 4 12c.9 2.2 4.1 5 8 5s7.1-2.8 8-5c-.9-2.2-4.1-5-8-5zm0 2a3 3 0 110 6 3 3 0 010-6z"/></svg>
                      <span className="btn-label">Watched</span>
                    </button>

                    <button
                      className="btn btn-danger btn-compact btn-icon"
                      onClick={() => removeItem(it.id)}
                      title="Delete"
                      aria-label="Delete"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 9h2v9H6V9z"/></svg>
                      <span className="btn-label">Delete</span>
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