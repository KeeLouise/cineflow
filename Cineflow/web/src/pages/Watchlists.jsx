import React, { useEffect, useState } from "react";                                               // react hooks
import { useNavigate, Link} from "react-router-dom";                                              // useNavigate helps to programmatically go to "/watchlists/:id" after creating a list
import { fetchMyWatchlists, createWatchlist, removeMovieFromWatchlist  } from "@/api/watchlists"; // imports api helpers to load the user's lists and create a new one

export default function Watchlists() {
    const navigate = useNavigate();

    // Local state - what the UI needs to remember
    const [lists, setLists] = useState([]);       // user's watchlists - starts as an empty array
    const [loading, setLoading] = useState(true); // show a spinner while loading until API finishes
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");       // a place to show any error text

    // "Create new list" form fields
    const [newName, setNewName] = useState("");             // text input for list name


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
  }, []);                                      // empty array [] means this effect only runs once when page loads


async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim() || submitting) return;
    setError("");
    setSubmitting(true);                                 
    try {
      const wl = await createWatchlist(newName);          
      setLists((prev) => [wl, ...prev]);
      setNewName("");
    } catch (err) {
      setError(err.message || "Create failed");
      console.error("Create failed:", err);
    } finally {
      setSubmitting(false);                               
    }
  }


  if (loading) return <p>Loading...</p>;
  return (
    <div className="container py-4">
      <h1 className="mb-3">My Watchlists</h1>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Create new watchlist */}
      <form onSubmit={handleCreate} className="mb-4 d-flex gap-2">
        <input
          type="text"
          className="form-control"
          placeholder="New watchlist name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={submitting}                         
        >
          {submitting ? "Creating…" : "Create"}
        </button>
      </form>

      {/* Lists */}
      {lists.length === 0 ? (
        <p>You don't have any watchlists yet.</p>
      ) : (
        <ul className="list-group">
          {lists.map((wl) => (
            <li key={wl.id} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>{wl.name}</strong>
                <span className="text-muted ms-2">
                  {wl.items?.length || 0} movies
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>

  );
}