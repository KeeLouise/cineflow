import React, { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "@/api/profile";
import api from "@/api/client";
import "@/styles/security.css";

const isValidEmail = (v = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

export default function Profile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  const [emailTouched, setEmailTouched] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyProfile();
        setMe(data);
      } catch {
        setError("Could not load profile.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    if (!me) return;
    setSaving(true);
    setError("");

    // Validate email before save
    if (me.email && !isValidEmail(me.email)) {
      setEmailTouched(true);
      setSaving(false);
      setError("Please enter a valid email address.");
      return;
    }

    try {
      const updated = await updateMyProfile(me);
      setMe(updated);
    } catch {
      setError("Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResend() {
    setResendMsg("");
    setError("");
    try {
      await api.post("/auth/resend_me/", {});
      setResendMsg("Verification email sent! Check your inbox.");
    } catch {
      setError("Could not resend verification email.");
    }
  }

  if (loading) return <div className="container py-4">Loading…</div>;

  const emailInvalid = !!me?.email && emailTouched && !isValidEmail(me.email);

  return (
    <div className="container py-4">
      <h1 className="h4 mb-3">My Profile</h1>
      {error && <div className="alert alert-danger">{error}</div>}
      {resendMsg && <div className="alert alert-success">{resendMsg}</div>}

      {/* Email not verified banner */}
      {me && !me.email_verified && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center">
          <span>Your email is not verified.</span>
          <button className="btn btn-sm btn-outline-dark" onClick={handleResend}>
            Resend verification
          </button>
        </div>
      )}

      {me && (
        <form onSubmit={handleSave} className="glass security-card p-3">
          <div className="mb-3">
            <label className="form-label">Username</label>
            <input
              className="form-control"
              value={me.username || ""}
              onChange={(e) => setMe({ ...me, username: e.target.value })}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className={`form-control ${emailInvalid ? "is-invalid" : ""}`}
              value={me.email || ""}
              onChange={(e) => setMe({ ...me, email: e.target.value })}
              onBlur={() => setEmailTouched(true)}
            />
            {emailInvalid && (
              <div className="invalid-feedback">Please enter a valid email address.</div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label">First Name</label>
            <input
              className="form-control"
              value={me.first_name || ""}
              onChange={(e) => setMe({ ...me, first_name: e.target.value })}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Last Name</label>
            <input
              className="form-control"
              value={me.last_name || ""}
              onChange={(e) => setMe({ ...me, last_name: e.target.value })}
            />
          </div>

          {/* Avatar */}
          {me.avatar && (
            <div className="mb-3">
              <img
                src={me.avatar}
                alt="Avatar"
                style={{ width: 80, height: 80, borderRadius: "50%" }}
              />
            </div>
          )}
          <div className="mb-3">
            <label className="form-label">Change Avatar</label>
            <input
              type="file"
              className="form-control"
              accept="image/*"
              onChange={(e) =>
                setMe({ ...me, avatar: e.target.files ? e.target.files[0] : null })
              }
            />
          </div>

          <button
            className="btn btn-gradient"
            type="submit"
            disabled={saving || (me.email && !isValidEmail(me.email))}
            title={me.email && !isValidEmail(me.email) ? "Fix email address" : ""}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      )}
    </div>
  );
}