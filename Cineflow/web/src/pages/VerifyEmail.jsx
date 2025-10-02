import React, { useEffect, useState } from "react";
import API_ROOT from "@/utils/apiRoot";
import AuthLayout from "@/components/AuthLayout";

export default function VerifyEmail() {
  const [state, setState] = useState({ status: "working", message: "Verifying your email…" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) { setState({ status: "error", message: "Missing verification token." }); return; }

    (async () => {
      try {
        const res = await fetch(`${API_ROOT}/auth/verify/?token=${encodeURIComponent(token)}&redirect=0`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setState({ status: "ok", message: "Email verified! You can now sign in." });
        } else {
          const d = (data && data.detail) || "Verification failed.";
          if (/expired/i.test(d)) setState({ status: "expired", message: "Verification link expired. Please request a new one." });
          else if (/invalid/i.test(d)) setState({ status: "error", message: "Invalid verification link." });
          else setState({ status: "error", message: d });
        }
      } catch {
        setState({ status: "error", message: "Network error verifying email. Try again." });
      }
    })();
  }, []);

  const body = (
    <>
      {state.status === "working" && <div className="callout info">{state.message}</div>}
      {state.status === "ok" && <div className="callout success">{state.message}</div>}
      {state.status === "expired" && (
        <div className="callout warn">
          {state.message}
          <div className="mt-12">
            <a className="btn btn-ghost" href="/profile">Resend from Profile</a>
          </div>
        </div>
      )}
      {state.status === "error" && <div className="callout error">{state.message}</div>}

      {(state.status === "ok" || state.status === "error") && (
        <div className="mt-12">
          <a className="btn btn-primary" href="/login">Go to Login</a>
        </div>
      )}
    </>
  );

  return (
    <AuthLayout title="Verify your email" subtitle="One last step to secure your account.">
      {body}
    </AuthLayout>
  );
}