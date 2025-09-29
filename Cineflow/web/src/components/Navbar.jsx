import React, { useEffect, useState } from "react";       
import { NavLink, Link, useNavigate } from "react-router-dom";
import { looksLoggedIn, logout } from "@/api/auth";
import logo from "../assets/logo.webp";
import "../styles/navbar.css";

export default function Navbar() {
  const [authed, setAuthed] = useState(looksLoggedIn());
  const navigate = useNavigate();                         

  useEffect(() => {
    const onAuth = () => setAuthed(looksLoggedIn());
    window.addEventListener("auth-changed", onAuth);
    window.addEventListener("storage", onAuth); // reacts if another tab logs in/out
    return () => {
      window.removeEventListener("auth-changed", onAuth);
      window.removeEventListener("storage", onAuth);
    };
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
      <button onClick={handleLogout} className="btn btn-link nav-link">
        Logout
      </button>
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