import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { looksLoggedIn, logout } from "@/api/auth";
import { getMyProfile } from "@/api/profile";
import logo from "@/assets/logo.webp";
import "@/styles/navbar.css";
import { mediaUrl } from "@/utils/media";

export default function Navbar() {
  const [authed, setAuthed] = useState(looksLoggedIn());
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onAuth = () => setAuthed(looksLoggedIn());
    window.addEventListener("auth-changed", onAuth);
    window.addEventListener("storage", onAuth);
    return () => {
      window.removeEventListener("auth-changed", onAuth);
      window.removeEventListener("storage", onAuth);
    };
  }, []);

  const normalizeProfile = (p) => {
    if (!p || typeof p !== "object") return null;
    const raw = p.avatar || "";
    let url = raw ? mediaUrl(raw) : "";
    if (url && p.updated_at) {
      try {
        const u = new URL(url, window.location.origin);
        const v = Date.parse(p.updated_at);
        if (!Number.isNaN(v)) u.searchParams.set("v", String(v));
        url = u.toString();
      } catch {}
    }
    return { ...p, avatar: url };
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!authed) {
        if (alive) setMe(null);
        return;
      }
      try {
        const data = await getMyProfile();
        if (!alive) return;
        setMe(normalizeProfile(data));
      } catch {
        if (alive) setMe(null);
      }
    })();
    return () => { alive = false; };
  }, [authed]);

  function handleLogout() {
    logout();
    setOpen(false);
    navigate("/");
  }

  const avatarEl = useMemo(() => {
    const size = 28;
    const initials = (me?.username?.trim()?.charAt(0)?.toUpperCase() || "U");
    if (me?.avatar) {
      return (
        <img
          src={me.avatar}
          alt={me?.username || "Profile"}
          className="rounded-circle"
          width={size}
          height={size}
          style={{ objectFit: "cover" }}
          onError={(e) => {
            e.currentTarget.onerror = null;
            const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(me?.username || "User")}&size=64&background=7c5cff&color=fff`;
            e.currentTarget.src = fallback;
          }}
        />
      );
    }
    return (
      <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center" aria-label="Avatar">
        {initials}
      </div>
    );
  }, [me?.avatar, me?.username]);

  return (
    <nav className="navbar navbar-expand-lg px-3 big-navbar navbar-thin">
      <div className="container-fluid">
        <Link className="navbar-brand d-flex align-items-center" to="/" onClick={() => setOpen(false)}>
          <img src={logo} alt="Cineflow Logo" className="logo-img" />
        </Link>

        {/* Mobile toggler */}
        <button
          className="navbar-toggler"
          type="button"
          aria-expanded={open ? "true" : "false"}
          aria-label="Toggle navigation"
          aria-controls="mainNav"           
          onClick={() => setOpen((v) => !v)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div id="mainNav" className={`collapse navbar-collapse ${open ? "show" : ""}`}>
          <ul className="navbar-nav ms-auto align-items-lg-center">
            <li className="nav-item">
              <NavLink to="/" className="nav-link" onClick={() => setOpen(false)}>
                Home
              </NavLink>
            </li>

            {authed ? (
              <>
                <li className="nav-item">
                  <NavLink to="/dashboard" className="nav-link" onClick={() => setOpen(false)}>
                    Mood Dashboard
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/watchlists" className="nav-link" onClick={() => setOpen(false)}>
                    Watchlists
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/rooms" className="nav-link" onClick={() => setOpen(false)}>
                    Rooms
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/profile" className="nav-link d-flex align-items-center gap-2" onClick={() => setOpen(false)}>
                    {avatarEl}
                    <span className="d-none d-sm-inline">{me?.username || "Profile"}</span>
                  </NavLink>
                </li>
                <li className="nav-item">
                  <button onClick={handleLogout} className="btn btn-link nav-link">
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <NavLink to="/login" className="nav-link" onClick={() => setOpen(false)}>
                    Login
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/register" className="nav-link" onClick={() => setOpen(false)}>
                    Register
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}