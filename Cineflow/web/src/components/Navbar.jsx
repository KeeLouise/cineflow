import { NavLink, Link } from "react-router-dom";
import { isAuthenticated, logout  } from "@/api/auth";
import "@/styles/navbar.css";

export default function Navbar() {
    const authed = isAuthenticated();

   return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-3">
      <div className="container-fluid">
        <Link className="navbar-brand fw-bold" to="/">Cineflow</Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNavbar"
          aria-controls="mainNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"/>
        </button>

        <div className="collapse navbar-collapse" id="mainNavbar">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  "nav-link" + (isActive ? " active" : "")
                }
              >
                Home
              </NavLink>
            </li>

            {authed && (
              <li className="nav-item">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    "nav-link" + (isActive ? " active" : "")
                  }
                >
                  Dashboard
                </NavLink>
              </li>
            )}
          </ul>

          <div className="d-flex gap-2">
            {!authed ? (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    "btn btn-outline-light" + (isActive ? " active" : "")
                  }
                >
                  Login
                </NavLink>
                <NavLink to="/register" className="btn btn-success">
                  Sign Up
                </NavLink>
              </>
            ) : (
              <>
                <span className="navbar-text me-2 d-none d-md-inline">
                  Signed in
                </span>
                <button className="btn btn-danger" onClick={logout}>
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}