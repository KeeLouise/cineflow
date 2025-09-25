const API_BASE = "/api"; //Base URL for backend - KR 24/09/2025

function authHeaders() {                                     // a helper that builds headers for authenticated requests
  try {
    const token = typeof window !== "undefined" && window.localStorage
      ? window.localStorage.getItem("access")               //reads JWT access token saved at login
      : null;
    return token ? { Authorization: `Bearer ${token}` } : {}; //if a token exists, return the header object ({Authorization:"Bearer..."}`). If not, return an empty object
  } catch {
    return {};
  }
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
  const res = await fetch(`${API_BASE}${path}`, { //always prefixes the path with /api and sets the HTTP method
    method: "GET",
    headers: { ...authHeaders() }, //merges authorization headers if token exists
  });
  return handle(res);
}

async function post(path, bodyObj) {
  // ✅ Fix: PATH -> path (was a typo)
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(bodyObj),                                    // body: JSON.stringify(bodyObj) converts a plain JS object to JSON text
  });
  return handle(res);                                                 // all responses flow through the one parser/thrower so components do not repeat error parsing
}

async function del(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
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

export function fetchWatchlist(id) {                                 // GET /api/watchlists/:id/  - fetch one list (with nested items)
  return get(`/watchlists/${id}/`);
}

export function deleteWatchlist(id) {                                // DELETE /api/watchlists/:id/  - delete a whole list
  return del(`/watchlists/${id}/`);
}