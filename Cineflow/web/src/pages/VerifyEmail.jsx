import { useSearchParams, Link } from "react-router-dom";
import api from "@/api/client";
import { useState } from "react";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const ok = params.get("ok");
  const reason = params.get("reason");

  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  async function handleResend() {
    setResending(true);
    setResendMsg("");
    try {
      await api.post("/auth/resend_me/");
      setResendMsg("Verification email sent! Check your inbox.");
    } catch {
      setResendMsg("Could not resend verification email. Try again later.");
    } finally {
      setResending(false);
    }
  }

  if (ok === "1") {
    return (
      <div className="container py-4">
        <div className="alert alert-success mb-3">
          ✅ Your email has been verified successfully!
        </div>
        <Link to="/login" className="btn btn-gradient">
          Go to Login
        </Link>
      </div>
    );
  }

  if (ok === "0" && reason === "expired") {
    return (
      <div className="container py-4">
        <div className="alert alert-warning mb-3">
          ⚠️ Verification link expired. Please request a new one.
        </div>
        <button
          className="btn btn-outline-dark"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? "Resending…" : "Resend verification email"}
        </button>
        {resendMsg && <div className="mt-2 alert alert-info">{resendMsg}</div>}
      </div>
    );
  }

  if (ok === "0" && reason === "invalid") {
    return (
      <div className="container py-4">
        <div className="alert alert-danger mb-3">
          ❌ Invalid verification link. Please request a new one.
        </div>
        <button
          className="btn btn-outline-dark"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? "Resending…" : "Resend verification email"}
        </button>
        {resendMsg && <div className="mt-2 alert alert-info">{resendMsg}</div>}
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="alert alert-info">Processing verification…</div>
    </div>
  );
}