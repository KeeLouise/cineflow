import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMyRooms, createRoom, joinRoom } from "@/api/rooms";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [creating, setCreating] = useState(false);
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");

  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchMyRooms();           // GET /api/rooms/
        if (!alive) return;
        setRooms(data || []);
      } catch (e) {
        if (alive) setErr(e.message || "Failed to load rooms.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!cName.trim() || creating) return;
    setErr("");
    setCreating(true);
    try {
      const room = await createRoom({
        name: cName.trim(),
        description: cDesc.trim(),
      });
      setRooms((r) => [room, ...r]);
      setCName("");
      setCDesc("");
    } catch (e) {
      setErr(e.message || "Could not create room.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim() || joining) return;
    setErr("");
    setJoining(true);
    try {
      const room = await joinRoom(code.trim());      // POST /api/rooms/join/
      setRooms((r) => {
        const exists = r.find((x) => x.id === room.id);
        return exists ? r.map((x) => (x.id === room.id ? room : x)) : [room, ...r];
      });
      setCode("");
    } catch (e) {
      setErr(e.message || "Could not join room.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="container py-4">
      <header className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 m-0">Rooms</h1>
      </header>

      {err && <div className="alert alert-danger glass">{err}</div>}

      {/* Create / Join bar */}
      <div className="glass p-3 mb-3 d-flex flex-wrap gap-2">
        <form className="d-flex gap-2 align-items-center flex-wrap" onSubmit={handleCreate}>
          <input
            className="form-control wl-input"
            placeholder="New room name…"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            maxLength={120}
          />
          <input
            className="form-control wl-input minw-220"
            placeholder="Description (optional)"
            value={cDesc}
            onChange={(e) => setCDesc(e.target.value)}
            maxLength={300}
          />
          <button className="btn btn-gradient" disabled={creating || !cName.trim()}>
            {creating ? "Creating…" : "Create"}
          </button>
        </form>

        <form className="ms-auto d-flex gap-2 align-items-center" onSubmit={handleJoin}>
          <input
            className="form-control wl-input w-180"
            placeholder="Invite code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn btn-outline-ghost" disabled={joining || !code.trim()}>
            {joining ? "Joining…" : "Join"}
          </button>
        </form>
      </div>

      {/* Rooms list */}
      {loading ? (
        <div className="glass p-4 text-center">Loading…</div>
      ) : rooms.length === 0 ? (
        <div className="glass p-4 text-center text-muted">
          No rooms yet. Create one above or join with an invite code.
        </div>
      ) : (
        <div className="row g-3">
          {rooms.map((r) => (
            <div key={r.id} className="col-12 col-md-6 col-xl-4">
              <div className="room-card glass h-100 d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between">
                  <h3 className="mb-0">{r.name}</h3>
                  <span className="badge text-bg-dark">
                    {(r.members?.length ?? 0)} members
                  </span>
                </div>

                {r.description ? (
                  <p className="text-muted mt-2 mb-3">{r.description}</p>
                ) : (
                  <div className="mb-3" />
                )}

                <div className="mt-auto d-flex justify-content-end gap-2">
                  <Link to={`/rooms/${r.id}`} className="btn btn-outline-ghost">
                    Open
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}