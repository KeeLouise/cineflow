import React, { useEffect, useState } from "react";
import API_ROOT from "@/utils/apiRoot";

export default function VerifyEmail() {
  const [state, setState] = useState({ status: "working", message: "Verifying your email…" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setState({ status: "error", message: "Missing verification token." });
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${API_ROOT}/auth/verify/?token=${encodeURIComponent(token)}&redirect=0`,
          { method: "GET", credentials: "omit" }
        );
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          setState({ status: "ok", message: "Email verified! You can now sign in." });
        } else {
          const detail = (data && data.detail) || "Verification failed.";
          if (/expired/i.test(detail)) {
            setState({ status: "expired", message: "Verification link expired. Please request a new one." });
          } else if (/invalid/i.test(detail)) {
            setState({ status: "error", message: "Invalid verification link." });
          } else {
            setState({ status: "error", message: detail });
          }
        }
      } catch (e) {
        console.error("Verify error:", e);
        setState({ status: "error", message: "Network error verifying email. Try again." });
      }
    })();
  }, []);

  return (
    <div className="container py-4">
      {state.status === "working" && <div className="alert alert-info">{state.message}</div>}
      {state.status === "ok" && <div className="alert alert-success">{state.message}</div>}
      {state.status === "expired" && (
        <div className="alert alert-warning">
          {state.message}
          <div className="mt-3">
            <a className="btn btn-outline-dark" href="/profile">Resend from Profile</a>
          </div>
        </div>
      )}
      {state.status === "error" && <div className="alert alert-danger">{state.message}</div>}

      {(state.status === "ok" || state.status === "error") && (
        <div className="mt-3">
          <a className="btn btn-gradient" href="/login">Go to Login</a>
        </div>
      )}
    </div>
  );
}