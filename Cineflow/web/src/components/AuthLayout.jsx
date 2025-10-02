import React from "react";
import { Link } from "react-router-dom";
import "@/styles/auth.css";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-bg">
      <div className="auth-grid">
        <div className="auth-card">
          <header className="auth-header">
            <Link to="/" className="brand">
              <span className="brand-dot" /> CINEFLOW
            </Link>
            {title && <h1 className="auth-title">{title}</h1>}
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          </header>

          <div className="auth-body">{children}</div>

          {footer && <footer className="auth-footer">{footer}</footer>}
        </div>
      </div>
    </div>
  );
}