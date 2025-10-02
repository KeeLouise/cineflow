import React, { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "@/api/account";
import AuthLayout from "@/components/AuthLayout";
import AuthField from "@/components/AuthField";
import AuthButton from "@/components/AuthButton";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(""); setLoading(true);
    try {
      await requestPasswordReset(email);
      setMsg("If the address exists, we’ve emailed reset instructions.");
    } finally { setLoading(false); }
  }

  const footer = (
    <div className="auth-links">
      <Link to="/login">Back to login</Link>
    </div>
  );

  return (
    <AuthLayout title="Forgot your password?" subtitle="We’ll send you a reset link." footer={footer}>
      {msg && <div className="callout info">{msg}</div>}
      <form onSubmit={onSubmit} className="vstack gap-12">
        <AuthField label="Email address" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required autoFocus />
        <AuthButton type="submit" loading={loading}>Send reset link</AuthButton>
      </form>
    </AuthLayout>
  );
}