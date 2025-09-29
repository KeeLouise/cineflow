import { authFetch } from "@/api/auth";

const API_BASE = "/api";

// helpers- KR 29/09/2025
async function handle(res) {
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message || data.error)) || (typeof data === "string" && data) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status; err.data = data; throw err;
  }
  return data;
}
function get(path)   { return authFetch(`${API_BASE}${path}`).then(handle); }
function post(path, body) {
  return authFetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(handle);
}
function patch(path, body) {
  return authFetch(`${API_BASE}${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(handle);
}

function del(path) {
  return authFetch(`${API_BASE}${path}`, { method: "DELETE" }).then(handle);
}

// Rooms
export function fetchMyRooms() {
  return get("/rooms/");
}
export function createRoom(payload) {           
  return post("/rooms/", payload);
}
export function joinRoom(invite_code) {
  return post("/rooms/join/", { invite_code });
}
export function fetchRoom(roomId) {
  return get(`/rooms/${roomId}/`);
}
export function updateRoom(roomId, patchPayload) {
  return patch(`/rooms/${roomId}/`, patchPayload);
}
export function fetchRoomMembers(roomId) {
  return get(`/rooms/${roomId}/members/`);
}
export function fetchRoomMovies(roomId) {
  return get(`/rooms/${roomId}/movies/`);
}
export function addRoomMovie(roomId, m) {        
  return post(`/rooms/${roomId}/movies/`, m);
}
export function reorderRoomMovies(roomId, order) { 
  return post(`/rooms/${roomId}/movies/reorder/`, { order });
}
export function voteRoomMovie(roomId, movieId, value) { 
  return post(`/rooms/${roomId}/movies/${movieId}/vote/`, { value });
}

export function removeRoomMovie(roomId, movieId) {
  return authFetch(`/api/rooms/${roomId}/movies/${movieId}/`, {
    method: "DELETE",
  }).then(async (res) => {
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    return true;
  });
}

export function deleteRoom(roomId) {
  return authFetch(`/api/rooms/${roomId}/`, { method: "DELETE" }).then(handle);
}

// Watchlist collaborators (owner-only) - KR 29/09/2025
export function listCollaborators(listId) {
  return get(`/watchlists/${listId}/collaborators/`);
}
export function addCollaborator(listId, { username, can_edit = true }) {
  return post(`/watchlists/${listId}/collaborators/`, { username, can_edit });
}
export function removeCollaborator(listId, userId) {
  return del(`/watchlists/${listId}/collaborators/?user_id=${encodeURIComponent(userId)}`);
}