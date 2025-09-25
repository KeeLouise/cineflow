import React, { useEffect, useState } from "react";                                               // react hooks
import { useNavigate, Link} from "react-router-dom";                                              // useNavigate helps to programmatically go to "/watchlists/:id" after creating a list
import { fetchMyWatchlists, createWatchlist, removeMovieFromWatchlist  } from "@/api/watchlists"; // imports api helpers to load the user's lists and create a new one

export default function Watchlists() {
    const navigate = useNavigate();

    // Local state - what the UI needs to remember
    const [lists, setLists] = useState([]);       // user's watchlists - starts as an empty array
    const [loading, setLoading] = useState(true); // show a spinner while loading until API finishes
    const [error, setError] = useState("");       // a place to show any error text

    // "Create new list" for fields
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


async function handleCreate(e) {                    // handles submitting the new list form
    e.preventDefault();                             // stop page from reloading
    if (!newName.trim()) return;                    // if input is empty, return early
    try {
        const wl = await createWatchlist (newName); // ask backend to create
        setLists([wl, ...lists]);                   // put new list first, keep others
        setNewName("");                             // reset input
    }   catch (err) {
        setError(err.message);                      // show error if failed
    }
}


if (loading) return <p>Loading...</p>;
if (error)   return <p className="text-danger">Error: {error}</p>;


  return (
    <div className="container py-4">
      <h1 className="mb-3">My Watchlists</h1>

      {/* Form for creating a new watchlist */}
      <form onSubmit={handleCreate} className="mb-4 d-flex gap-2">
        <input
          type="text"
          className="form-control"
          placeholder="New watchlist name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          Create
        </button>
      </form>

      {/* If there are no lists yet, show a message; else loop over lists */}
      {lists.length === 0 ? (
        <p>You don't have any watchlists yet.</p>
      ) : (
        <ul className="list-group">
          {lists.map((wl) => (
            <li key={wl.id} className="list-group-item">
              <strong>{wl.name}</strong>
              <span className="text-muted ms-2">
                {wl.items?.length || 0} movies
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}