import { NavLink, Link } from "react-router-dom";
import { isAuthenticated, logout } from "../api/auth";
import logo from "../assets/logo.webp";
import "../styles/navbar.css";

export default function Navbar() {
  const authed = isAuthenticated();

  return (
    <nav className="navbar navbar-expand-lg px-3 big-navbar">
      <div className="container-fluid">
        <a className="navbar-brand" href="/">
        <img
          src={logo}
          alt="Cineflow Logo"
          className="logo-img"
        />
      </a>

        <div className="collapse navbar-collapse">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <NavLink to="/" className="nav-link">Home</NavLink>
            </li>
            {!authed ? (
              <>
                <li className="nav-item">
                  <NavLink to="/login" className="nav-link">Login</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/register" className="nav-link">Register</NavLink>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
                </li>
                <li className="nav-item">
                  <button onClick={logout} className="btn btn-link nav-link">
                    Logout
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}