import { Link } from "react-router-dom";
import "@/styles/errors.css";

export default function NotFound() {
  return (
    <div className="err-bg">
      <div className="err-card">
        <div className="err-head">
          <span className="brand">
            <span className="brand-dot" />
            Cineflow
          </span>
          <h1 className="err-title">Page not found</h1>
          <p className="err-sub">Sorry, we couldn’t find what you were looking for.</p>
        </div>

        <div className="err-body">
          <div className="err-code">404</div>
          <p className="err-help">
            The page may have been moved or the link is invalid.
          </p>
          <div className="err-actions">
            <Link className="btn btn-primary" to="/">Go home</Link>
            <button className="btn btn-ghost" onClick={() => window.history.back()}>
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}