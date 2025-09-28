import { authFetch } from "@/api/auth";

const API_BASE = "/api"; // Base URL for backend - KR 24/09/2025

// ---------- Shared helpers ----------

// central response handler to parse JSON or throw helpful errors - KR 26/09/2025
async function handle(res) {
  const text = await res.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);   // try JSON
    } catch {
      data = text;               // fall back to plain text
    }
  }

  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message || data.error)) ||
      (typeof data === "string" && data) ||
      `HTTP ${res.status}`;

    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data; // on success, return parsed JSON (or null)
}

function authHeaders() {
  const token = localStorage.getItem("access");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// wrapper helpers to reduce repetition - KR 24/09/2025
function get(path) {
  return authFetch(`${API_BASE}${path}`, { method: "GET" }).then(handle);
}
function post(path, body) {
  return authFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handle);
}
function put(path, body) {
  return authFetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handle);
}
function del(path) {
  return authFetch(`${API_BASE}${path}`, { method: "DELETE" }).then(handle);
}

// ---------- API Calls ----------

export function fetchMyWatchlists() {                                // GET /api/watchlists/ - list all watchlists for current user
  return get("/watchlists/");
}

export function createWatchlist(name, isPublic = false) {            // POST /api/watchlists/ {name, is_public}
  return post("/watchlists/", { name, is_public: isPublic });
}

export function fetchWatchlist(id) {                                 // GET /api/watchlists/:id/ - fetch one list (with nested items)
  return get(`/watchlists/${id}/`);
}

export function deleteWatchlist(id) {                                // DELETE /api/watchlists/:id/ - delete a whole list
  return del(`/watchlists/${id}/`);
}

export function addMovieToWatchlist(listId, movie) {                 // POST /api/watchlists/:id/items/ {tmdb_id, title, poster_path}
  return post(`/watchlists/${listId}/items/`, {
    tmdb_id: movie.id,
    title: movie.title,
    poster_path: movie.poster_path ?? "",
  });
}

export function removeMovieFromWatchlist(listId, itemId) {           // DELETE /api/watchlists/:listId/items/:itemId
  return del(`/watchlists/${listId}/items/${itemId}/`);
}

export function updateWatchlist(id, payload) {                       // PUT /api/watchlists/:id/ {name?, is_public?}
  return put(`/watchlists/${id}/`, payload);
}

export function updateWatchlistItem(listId, itemId, payLoad) {   
    return fetch(`/api/watchlists/${listId}/items/${itemId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payLoad),
    })  .then(handle);   
}

export function reorderWatchlistItems(listId, order) {             // POST /api/watchlists/:listId/reorder/ {order:[itemId,...]}
  return post(`/watchlists/${listId}/reorder/`, { order });        // sends explicit item ID order to backend - KR 30/09/2025
}