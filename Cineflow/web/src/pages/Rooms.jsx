import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMyRooms, createRoom, joinRoom } from "@/api/rooms";
import { mediaUrl } from "@/utils/media";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // create form
  const [creating, setCreating] = useState(false);
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");

  // join form
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const data = await fetchMyRooms();
        if (!alive) return;

        const list = Array.isArray(data) ? data : [];
        // keep only active rooms (treat missing is_active as true)
        setRooms(list.filter(r => r?.is_active !== false));
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load rooms.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (creating) return;

    const name = cName.trim();
    const description = cDesc.trim();
    if (!name) return;

    setErr("");
    setCreating(true);
    try {
      const room = await createRoom({ name, description });
      setRooms(prev => {
        const next = Array.isArray(prev) ? prev : [];
        return [room, ...next].filter(r => r?.is_active !== false);
      });
      setCName("");
      setCDesc("");
    } catch (e) {
      setErr(e?.message || "Could not create room.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (joining) return;

    const invite = code.trim();
    if (!invite) return;

    setErr("");
    setJoining(true);
    try {
      const room = await joinRoom(invite);
      setRooms(prev => {
        const list = Array.isArray(prev) ? prev : [];
        const idx = list.findIndex(x => x?.id === room?.id);
        const merged = idx >= 0 ? list.map(x => (x?.id === room?.id ? room : x)) : [room, ...list];
        return merged.filter(r => r?.is_active !== false);
      });
      setCode("");
    } catch (e) {
      setErr(e?.message || "Could not join room.");
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

      <div className="glass p-3 mb-3 d-flex flex-wrap gap-2">
        {/* Create room */}
        <form className="d-flex gap-2 align-items-center flex-wrap" onSubmit={handleCreate}>
          <input
            className="form-control wl-input"
            placeholder="New room name…"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            maxLength={120}
          />
          <input
            className="form-control wl-input"
            placeholder="Description (optional)"
            value={cDesc}
            onChange={(e) => setCDesc(e.target.value)}
            maxLength={300}
          />
          <button className="btn btn-gradient" disabled={creating || !cName.trim()}>
            {creating ? "Creating…" : "Create"}
          </button>
        </form>

        {/* Join room */}
        <form className="ms-auto d-flex gap-2 align-items-center" onSubmit={handleJoin}>
          <input
            className="form-control wl-input"
            placeholder="Invite code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn btn-outline-ghost" disabled={joining || !code.trim()}>
            {joining ? "Joining…" : "Join"}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="glass p-4 text-center">Loading…</div>
      ) : (Array.isArray(rooms) ? rooms : []).length === 0 ? (
        <div className="glass p-4 text-center text-muted">
          No rooms yet. Create one above or join with an invite code.
        </div>
      ) : (
        <div className="row g-3">
          {(Array.isArray(rooms) ? rooms : []).map((r) => {
            const rid = Number(r?.id);
            const members = Array.isArray(r?.members) ? r.members : [];
            return (
              <div key={Number.isFinite(rid) ? rid : `room-${Math.random()}`} className="col-12 col-md-6 col-xl-4">
                <div className="room-card glass h-100 d-flex flex-column">
                  <div className="d-flex align-items-center justify-content-between">
                    <h3 className="mb-0">{r?.name || "Room"}</h3>
                    <div className="d-flex align-items-center" style={{ gap: 6 }}>
                      <div className="d-flex" style={{ position: "relative", height: 28 }}>
                        {members.slice(0, 5).map((m, idx) => {
                          const src = m?.avatar ? `${mediaUrl(m.avatar)}?v=${Date.now()}` : null;
                          return src ? (
                            <img
                              key={m?.id ?? `${m?.username ?? "u"}-${idx}`}
                              src={src}
                              alt={m?.username || "member"}
                              title={m?.username || ""}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "1px solid rgba(255,255,255,.3)",
                                position: "relative",
                                left: idx ? -idx * 10 : 0,
                                background: "rgba(255,255,255,.08)",
                              }}
                              onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                            />
                          ) : (
                            <div
                              key={m?.id ?? `${m?.username ?? "u"}-${idx}`}
                              title={m?.username || ""}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                position: "relative",
                                left: idx ? -idx * 10 : 0,
                                border: "1px solid rgba(255,255,255,.3)",
                                background: "rgba(255,255,255,.08)",
                                fontSize: 12,
                              }}
                            >
                              {(m?.username?.[0] || "?").toUpperCase()}
                            </div>
                          );
                        })}
                      </div>
                      <span className="badge text-bg-dark">{members.length} members</span>
                    </div>
                  </div>

                  {r?.description ? (
                    <p className="text-muted mt-2 mb-3">{r.description}</p>
                  ) : <div className="mb-3" />}

                  <div className="mt-auto d-flex justify-content-end gap-2">
                    <Link to={`/rooms/${rid}`} className="btn btn-outline-ghost">
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}