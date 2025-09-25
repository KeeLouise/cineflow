import { authFetch } from "@/api/auth";

const API_BASE = "/api"; //Base URL for backend - KR 24/09/2025

function authHeaders() {                                     // a helper that builds headers for authenticated requests
  const token = localStorage.getItem("access");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {                         // a central response handler to avoid repeating error parsing everywhere
  const text = await res.text();                     // read raw text from the response(works whether or not there's a JSON body)
  let data = null;
  
  if (text) {                                        // if there is a body, try to parse JSON. If parsing fails, text is kept
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {                                                              // when http status is not ok (e.g 400/401/500) error is created with a message. It will prefer detail, message or error fields if the server sent JSON
    const msg = (data && (data.detail || data.message || data.error)) ||
                (typeof data === "string" && data) ||
                `HTTP ${res.status}`;

    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;   // on success, return parsed JSON
}

// ---------- Helpers ----------

async function get(path) {
  const res = await authFetch(`${API_BASE}${path}`, {method: "GET",});
  return handle(res);
}

async function post(path, bodyObj) {
  const res = await authFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj),
  });
  return handle(res);
}

async function del(path) {
  const res = await authFetch(`${API_BASE}${path}`, { method: "DELETE" });
  return handle(res);
}

// ---------- API Calls ----------

export function fetchMyWatchlists() {                                // Lists the current user's watchlists
  return get("/watchlists/");
}

export function createWatchlist(name, isPublic = false) {            // POST /api/watchlists/ {name, is_public}
  return post("/watchlists/", { name, is_public: isPublic });
}

export function addMovieToWatchlist(listId, movie) {                 //POST /api/watchlists/:id/items/ {tmdb_id, title, poster_path}
  return post(`/watchlists/${listId}/items/`, {
    tmdb_id: movie.id,
    title: movie.title,
    poster_path: movie.poster_path ?? "",
  });
}

export function removeMovieFromWatchlist(listId, itemId) {           //DELETE /api/watchlists/:listId/items/:itemId
  return del(`/watchlists/${listId}/items/${itemId}/`);
}

export function updateWatchlist(id, payload) {
    return fetch(`/api/watchlists/${id}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
    }) .then(handle);
}

export function fetchWatchlist(id) {                                 // GET /api/watchlists/:id/  - fetch one list (with nested items)
  return get(`/watchlists/${id}/`);
}

export function deleteWatchlist(id) {                                // DELETE /api/watchlists/:id/  - delete a whole list
  return del(`/watchlists/${id}/`);
}