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
    const [name, setName] = useState("");             // text input for list name
}

useEffect(() => {                                   // useEffect runs side-effects such as fetching data after first render
    async function load() {
        try {
            const data = await fetchMyWatchlists(); // ask backend for user's lists
            setLists(data);                         // updates our lists state so react will re-render
        }   catch (err) {                      
            setError(err.message);                  // if something fails, store error
        }   finally {
            setLoading(false);                      // either way, stop loading spinner
        }
    }
    load();
}, []);                                             // empty array [] means this effect only runs once when page loads


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
if (error) return <p classname="text-danger">Error: {error}</p>

return (
    <div classNme="container py-4">
        <h1 className="mb-3">My Watchlists</h1>

        <form onSubmit={handleCreate} className="mb-4 d-flex gap-2">
            <input
             type="text"
             classNmae="form-control"
             placeholder="New watchlist name"
             value={newName}
             onChange={(e) => setNewName(e.target.value)}
            />
            <button className="btn btn-primary" type="submit">
                Create
            </button>
        </form>
    </div>
)