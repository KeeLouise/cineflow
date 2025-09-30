import React, { useEffect, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { looksLoggedIn, logout } from "@/api/auth";
import { getMyProfile } from "@/api/profile";
import logo from "../assets/logo.webp";
import "../styles/navbar.css";
import { mediaUrl } from "@/utils/media";

export default function Navbar() {
  const [authed, setAuthed] = useState(looksLoggedIn());
  const [me, setMe] = useState(null);
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

  // helper to normalize avatar to absolute URL + cache-buster
  function normalizeProfile(p) {
    if (!p) return p;
    const url = p.avatar ? `${mediaUrl(p.avatar)}?v=${Date.now()}` : null;
    return { ...p, avatar: url };
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!authed) {
        setMe(null);
        return;
      }
      try {
        const data = await getMyProfile();
        if (alive) setMe(normalizeProfile(data));
      } catch {
        if (alive) setMe(null);
      }
    })();
    return () => { alive = false; };
  }, [authed]);

  useEffect(() => {
    function onProfileUpdated(e) {
      const data = e.detail;
      if (data) {
        setMe(prev => normalizeProfile({ ...(prev || {}), ...data }));
      } else {
        getMyProfile().then(d => setMe(normalizeProfile(d))).catch(() => {});
      }
    }
    window.addEventListener("profile-updated", onProfileUpdated);
    return () => window.removeEventListener("profile-updated", onProfileUpdated);
  }, []);

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <nav className="navbar navbar-expand-lg px-3 big-navbar navbar-thin">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">
          <img src={logo} alt="Cineflow Logo" className="logo-img" />
        </Link>

        <div className="collapse navbar-collapse">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <NavLink to="/" className="nav-link">Home</NavLink>
            </li>

            {authed ? (
              <>
                <li className="nav-item">
                  <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/watchlists" className="nav-link">Watchlists</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/rooms" className="nav-link">Rooms</NavLink>
                </li>

                <li className="nav-item">
                  <NavLink to="/profile" className="nav-link d-flex align-items-center gap-2">
                    {me?.avatar ? (
                      <img
                        src={me.avatar}
                        alt={me?.username || "Profile"}
                        className="rounded-circle"
                        style={{ width: 28, height: 28, objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center"
                        style={{ width: 28, height: 28 }}
                      >
                        {me?.username?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <span>{me?.username || "Profile"}</span>
                  </NavLink>
                </li>

                <li className="nav-item">
                  <button onClick={handleLogout} className="btn btn-link nav-link">Logout</button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <NavLink to="/login" className="nav-link">Login</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/register" className="nav-link">Register</NavLink>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}