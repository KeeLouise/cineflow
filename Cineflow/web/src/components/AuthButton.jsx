import React from "react";

export default function AuthButton({ children, loading, variant = "primary", ...rest }) {
  return (
    <button
      className={`btn ${variant === "ghost" ? "btn-ghost" : variant === "danger" ? "btn-danger" : "btn-primary"}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : null}
      <span>{loading ? "Please wait…" : children}</span>
    </button>
  );
}