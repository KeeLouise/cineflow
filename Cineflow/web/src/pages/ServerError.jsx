import { Link } from "react-router-dom";
import "@/styles/errors.css";

export default function ServerError() {
  return (
    <div className="err-bg">
      <div className="err-card">
        <div className="err-head">
          <span className="brand">
            <span className="brand-dot" />
            Cineflow
          </span>
          <h1 className="err-title">Something went wrong</h1>
          <p className="err-sub">An unexpected error occurred.</p>
        </div>

        <div className="err-body">
          <div className="err-code">500</div>
          <p className="err-help">Try again in a moment or return to the homepage.</p>
          <div className="err-actions">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
            <Link className="btn btn-ghost" to="/">Go home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}