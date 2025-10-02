import React, { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "@/api/profile";
import api from "@/api/client"; 
import {
  start2FAEmailSetup,
  confirm2FAEmailSetup,
  disable2FAEmail,
} from "@/api/account";
import "@/styles/security.css";

export default function Profile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  // 2FA state
  const [setupToken, setSetupToken] = useState("");
  const [code, setCode] = useState("");
  const [twoFaMsg, setTwoFaMsg] = useState("");
  const [twoFaError, setTwoFaError] = useState("");

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
      await api.post("/auth/resend_me/", {});
      setResendMsg("Verification email sent! Check your inbox.");
    } catch {
      setError("Could not resend verification email.");
    }
  }

  async function handleEnable2FA() {
    setTwoFaError(""); setTwoFaMsg("");
    try {
      const data = await start2FAEmailSetup();
      setSetupToken(data.setup_token);
      setTwoFaMsg("We emailed you a 6-digit code. Enter it below to confirm enabling 2FA.");
    } catch (err) {
      setTwoFaError("Could not start 2FA setup.");
    }
  }

  async function handleConfirm2FA(e) {
    e.preventDefault();
    setTwoFaError(""); setTwoFaMsg("");
    try {
      const data = await confirm2FAEmailSetup({ code, setupToken });
      if (data.enabled) {
        setTwoFaMsg("Email-based 2FA has been enabled.");
        setMe({ ...me, two_factor_enabled: true });
        setSetupToken(""); setCode("");
      }
    } catch {
      setTwoFaError("Invalid code. Please try again.");
    }
  }

  async function handleDisable2FA() {
    setTwoFaError(""); setTwoFaMsg("");
    try {
      const data = await disable2FAEmail();
      if (data.disabled) {
        setTwoFaMsg("2FA disabled.");
        setMe({ ...me, two_factor_enabled: false });
      }
    } catch {
      setTwoFaError("Could not disable 2FA.");
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
        <form onSubmit={handleSave} className="glass security-card p-3 mb-4">
          {/* Basic info */}
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

      {/* 2FA SECTION */}
      <div className="glass security-card p-3">
        <h2 className="h5">Two-Factor Authentication</h2>
        {twoFaError && <div className="alert alert-danger">{twoFaError}</div>}
        {twoFaMsg && <div className="alert alert-info">{twoFaMsg}</div>}

        {!me?.two_factor_enabled ? (
          setupToken ? (
            <form onSubmit={handleConfirm2FA}>
              <label className="form-label mt-2">Enter the 6-digit code:</label>
              <input
                className="form-control wl-input"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
              />
              <button className="btn btn-gradient mt-2" type="submit">
                Confirm & Enable
              </button>
            </form>
          ) : (
            <button className="btn btn-outline-dark mt-2" onClick={handleEnable2FA}>
              Enable Email 2FA
            </button>
          )
        ) : (
          <button className="btn btn-danger mt-2" onClick={handleDisable2FA}>
            Disable 2FA
          </button>
        )}
      </div>
    </div>
  );
}