import React, { useEffect, useState } from "react";                                               // react hooks
import { useNavigate, Link } from "react-router-dom";                                             // useNavigate helps to programmatically go to "/watchlists/:id" after creating a list
import { fetchMyWatchlists, createWatchlist, deleteWatchlist } from "@/api/watchlists";           // imports api helpers to load the user's lists and create/delete a list
import { updateWatchlist } from "@/api/watchlists";                                               // NEW: rename / toggle public - KR 25/09/2025
import "@/styles/watchlists.css";                                                                 // modern styles for this page - KR 25/09/2025

const TMDB_IMG = "https://image.tmdb.org/t/p/w92";                                               // lighter thumbs for strips

export default function Watchlists() {
  const navigate = useNavigate();

  // Local state - what the UI needs to remember
  const [lists, setLists] = useState([]);        // user's watchlists - starts as an empty array
  const [loading, setLoading] = useState(true);  // show a spinner while loading until API finishes
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");        // a place to show any error text

  // "Create new list" form fields
  const [newName, setNewName] = useState("");    // text input for list name

  // Inline edit UI state - KR 25/09/2025
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchMyWatchlists(); // GET /api/watchlists/
        setLists(data || []);                   // set to empty array if no data
      } catch (err) {
        setError(err.message || "Failed to load watchlists.");
      } finally {
        setLoading(false);                      // loading finished whether success or error
      }
    })();
  }, []);                                       // empty array [] means this effect only runs once when page loads

  async function handleCreate(e) {              // handles submitting the new list form
    e.preventDefault();
    if (!newName.trim() || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const wl = await createWatchlist(newName);          // POST /api/watchlists/
      setLists((prev) => [wl, ...prev]);                  // put new list first, keep others
      setNewName("");
    } catch (err) {
      setError(err.message || "Create failed");
      console.error("Create failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  // Start inline rename for a list - KR 25/09/2025
  function beginRename(wl) {
    setEditingId(wl.id);
    setEditingName(wl.name);
  }

  // Save rename via PUT /api/watchlists/:id/ - KR 25/09/2025
  async function saveRename(id) {
    const name = editingName.trim();
    if (!name) return;
    try {
      const updated = await updateWatchlist(id, { name });
      setLists((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setEditingId(null);
      setEditingName("");
    } catch (err) {
      setError(err.message || "Rename failed");
    }
  }

  // Cancel inline rename - KR 25/09/2025
  function cancelRename() {
    setEditingId(null);
    setEditingName("");
  }

  // Toggle public/private with UI - KR 25/09/2025
  async function togglePublic(wl) {
    const prev = lists;
    const nextPublic = !wl.is_public;
    setLists((p) => p.map((l) => (l.id === wl.id ? { ...l, is_public: nextPublic } : l)));
    try {
      await updateWatchlist(wl.id, { is_public: nextPublic });
    } catch (err) {
      setLists(prev);
      setError(err.message || "Update visibility failed");
    }
  }

  // Delete list with confirm + optimistic UI - KR 25/09/2025
  async function handleDelete(id) {
    if (!confirm("Delete this watchlist? This cannot be undone.")) return;
    const prev = lists;
    setLists((p) => p.filter((l) => l.id !== id));
    try {
      await deleteWatchlist(id); // DELETE /api/watchlists/:id/
    } catch (err) {
      setLists(prev); // rollback
      setError(err.message || "Delete failed");
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
          <p className="wl-subtitle">Group your movies into lists you can share or keep private.</p>
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
            maxLength={120}                           // gentle guard against super-long names - KR 25/09/2025
          />
          <button
            className="btn btn-gradient btn-gradient--v2"
            type="submit"
            disabled={submitting || !newName.trim()}       // prevent double-submit / empty - KR 25/09/2025
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
          <div className="row g-3 mt-2">
            {lists.map((wl) => (
              <div key={wl.id} className="col-12 col-sm-6 col-lg-4">
                <div className="wl-card glass h-100 d-flex flex-column">
                  <div className="wl-cover">
                    {(wl.items || []).length ? (
                      <div className="wl-thumbs" aria-label="Poster thumbnails">
                        {(wl.items || []).slice(0, 12).map((m, i) =>
                          m.poster_path ? (
                            <img
                              key={i}
                              className="wl-thumb"
                              src={`${TMDB_IMG}${m.poster_path}`}
                              alt={m.title || "Poster"}
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

                  <div className="wl-titlebar mt-3">
                    <div aria-hidden="true" />
                    {editingId === wl.id ? (
                      <div className="d-flex gap-2">
                        <input
                          className="form-control wl-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          maxLength={120}
                          autoFocus
                        />
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
                    ) : (
                      <div className="d-flex align-items-center gap-2 justify-content-center">
                        <h3 className="wl-name mb-0">{wl.name}</h3>
                        <span className={`wl-badge ${wl.is_public ? "wl-badge-success" : "wl-badge-dark"}`}>
                          {wl.is_public ? "Public" : "Private"}
                        </span>
                      </div>
                    )}
                    {/* right cell: actions */}
                    {editingId !== wl.id ? (
                      <div className="d-flex align-items-center gap-1 wl-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-compact"
                          onClick={() => togglePublic(wl)}
                          title={wl.is_public ? "Make Private" : "Make Public"}
                        >
                          {wl.is_public ? "Make Private" : "Make Public"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-compact"
                          onClick={() => beginRename(wl)}
                          title="Rename"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-compact"
                          onClick={() => handleDelete(wl.id)}
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="mt-3 d-flex justify-content-end">
                    <Link to={`/watchlists/${wl.id}`} className="btn btn-outline-ghost">
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}