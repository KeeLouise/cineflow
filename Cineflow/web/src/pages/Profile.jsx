import React, { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "@/api/profile";
import api from "@/api/client"; // axios instance with tokens attached
import "@/styles/security.css";

export default function Profile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyProfile();
        setMe(data);
      } catch (err) {
        setError("Could not load profile.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateMyProfile(me);
      setMe(updated);
    } catch (err) {
      setError("Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResend() {
    setResendMsg("");
    setError("");
    try {
      await api.post("/api/resend_me/");
      setResendMsg("Verification email sent! Check your inbox.");
    } catch (err) {
      setError("Could not resend verification email.");
    }
  }

  if (loading) return <div className="container py-4">Loading…</div>;

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
              className="form-control"
              value={me.email || ""}
              onChange={(e) => setMe({ ...me, email: e.target.value })}
            />
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

          <button className="btn btn-gradient" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      )}
    </div>
  );
}