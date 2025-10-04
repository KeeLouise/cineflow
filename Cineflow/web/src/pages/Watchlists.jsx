import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchMyWatchlists,
  createWatchlist,
  deleteWatchlist,
  updateWatchlist,
} from "@/api/watchlists";
import "@/styles/watchlists.css";

const TMDB_IMG = "https://image.tmdb.org/t/p/w92";

function posterUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${TMDB_IMG}${clean}`;
}

export default function Watchlists() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Create form
  const [newName, setNewName] = useState("");

  // Inline rename
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  // Load my lists
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchMyWatchlists();
        if (!alive) return;
        setLists(Array.isArray(data) ? data : []);
      } catch (err) {
        if (alive) setError(err.message || "Failed to load watchlists.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || submitting) return;

    setError("");
    setSubmitting(true);
    try {
      const wl = await createWatchlist(name);
      setLists((prev) => [wl, ...prev]);
      setNewName("");
    } catch (err) {
      setError(err.message || "Create failed.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  // Start inline rename
  function beginRename(wl) {
    setEditingId(wl.id);
    setEditingName(wl.name);
  }

  // Save rename
  async function saveRename(id) {
    const name = editingName.trim();
    if (!name) return;
    try {
      const updated = await updateWatchlist(id, { name });
      setLists((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setEditingId(null);
      setEditingName("");
    } catch (err) {
      setError(err.message || "Rename failed.");
    }
  }

  function cancelRename() {
    setEditingId(null);
    setEditingName("");
  }

  // Delete list
  async function handleDelete(id) {
    if (!confirm("Delete this watchlist? This cannot be undone.")) return;
    const prev = lists;
    setLists((p) => p.filter((l) => l.id !== id));
    try {
      await deleteWatchlist(id);
    } catch (err) {
      setLists(prev);
      setError(err.message || "Delete failed.");
    }
  }

  if (loading) {
    return (
      <div className="watchlists-page container py-5 d-flex justify-content-center">
        <div className="spinner-border spinner-lg" role="status" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="watchlists-page">
      {/* Hero header */}
      <header className="wl-hero">
        <div className="container">
          <h1 className="wl-title mb-2">My Watchlists</h1>
          <p className="wl-subtitle">Group your movies into lists you can manage and share.</p>
        </div>
      </header>

      <div className="container py-4 pb-5">
        {error && (
          <div className="alert alert-danger glass" role="alert">
            {error}
          </div>
        )}

        {/* Create new watchlist */}
        <form onSubmit={handleCreate} className="wl-create glass d-flex gap-2 align-items-center">
          <input
            type="text"
            className="form-control wl-input"
            placeholder="e.g. Cozy Autumn Nights"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            maxLength={120}
          />
          <button
            className="btn btn-gradient btn-gradient--v2"
            type="submit"
            disabled={submitting || !newName.trim()}
          >
            {submitting ? "Creating…" : "Create List"}
          </button>
        </form>

        {/* Lists */}
        {lists.length === 0 ? (
          <div className="wl-empty glass text-center">
            <div className="wl-empty-emoji">🍿</div>
            <h3 className="mt-2 mb-1">No watchlists yet</h3>
            <p className="text-muted mb-3">Start by creating your first list above.</p>
          </div>
        ) : (
          <div className="wl-grid mt-3">
            {lists.map((wl) => (
              <article key={wl.id} className="wl-card glass">
                {/* Cover / posters */}
                <div className="wl-cover">
                  {(wl.items || []).length ? (
                    <div className="wl-thumbs" aria-label="Poster thumbnails">
                      {(wl.items || []).slice(0, 12).map((m, i) =>
                        m?.poster_path ? (
                          <img
                            key={`${wl.id}-thumb-${i}`}
                            className="wl-thumb"
                            src={posterUrl(m.poster_path)}
                            alt={m?.title || "Poster"}
                            loading="lazy"
                          />
                        ) : null
                      )}
                    </div>
                  ) : (
                    <div className="wl-thumbs-empty">No posters yet</div>
                  )}

                  <div className="wl-count-chip">
                    {(wl.items?.length || 0)} {(wl.items?.length === 1 ? "movie" : "movies")}
                  </div>
                </div>

                {/* Title / rename */}
                <div className="wl-titlewrap">
                  {editingId === wl.id ? (
                    <div className="wl-rename">
                      <input
                        className="form-control wl-input"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        maxLength={120}
                        autoFocus
                      />
                      <div className="wl-rename-actions">
                        <button
                          type="button"
                          className="btn btn-success btn-compact"
                          onClick={() => saveRename(wl.id)}
                          disabled={!editingName.trim()}
                          title="Save"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-compact"
                          onClick={cancelRename}
                          title="Cancel"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <h3 className="wl-name mb-0">{wl.name}</h3>
                  )}
                </div>

                {/* Actions */}
                {editingId !== wl.id && (
                  <div className="wl-card-actions">
                    <div className="wl-actions-left">
                      <button
                        type="button"
                        className="btn btn-ghost btn-compact"
                        onClick={() => beginRename(wl)}
                        title="Rename"
                      >
                        Rename
                      </button>
                    </div>

                    <div className="wl-actions-right">
                      <Link to={`/watchlists/${wl.id}`} className="btn btn-outline-ghost">
                        Open
                      </Link>
                      <button
                        type="button"
                        className="btn btn-danger btn-compact"
                        onClick={() => handleDelete(wl.id)}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}