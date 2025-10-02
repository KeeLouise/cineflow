import { useEffect, useMemo, useState } from "react";
import api from "@/api/client";

export default function Navbar() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/me/profile/");
        if (mounted) setMe(data);
      } catch {
        // not logged in or error — silently ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  const version = useMemo(() => {
    if (!me?.updated_at) return Date.now();
    const t = Date.parse(me.updated_at);
    return Number.isFinite(t) ? t : Date.now();
  }, [me?.updated_at]);

  const avatarUrl = useMemo(() => {
    if (!me?.avatar) return "";
    try {
      const u = new URL(me.avatar, window.location.origin);
      u.searchParams.set("v", String(version));
      return u.toString();
    } catch {
      const sep = me.avatar.includes("?") ? "&" : "?";
      return `${me.avatar}${sep}v=${version}`;
    }
  }, [me?.avatar, version]);

  return (
    <nav className="navbar glass px-3">
      <a className="navbar-brand" href="/">Cineflow</a>
      <div className="ms-auto d-flex align-items-center gap-3">
        {me ? (
          <a href="/profile" className="d-flex align-items-center text-decoration-none">
            {me.avatar ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src =
                    "https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=" +
                    encodeURIComponent(me.username || "User");
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              />
            ) : (
              <div
                className="d-inline-flex justify-content-center align-items-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#0d6efd22",
                  color: "#cfe2ff",
                  fontWeight: 600,
                }}
              >
                {(me.username || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
          </a>
        ) : (
          <a className="btn btn-sm btn-outline-light" href="/login">Sign in</a>
        )}
      </div>
    </nav>
  );
}