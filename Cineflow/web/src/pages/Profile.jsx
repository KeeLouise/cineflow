import React, { useEffect, useState } from "react";
import { getMyProfile } from "@/api/profile";
import { mediaUrl } from "@/utils/media";
import {
  resendVerificationEmail,
  start2FAEmailSetup,
  confirm2FAEmailSetup,
  disable2FAEmail,
} from "@/api/account";
import "@/styles/security.css";

export default function Profile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 2FA enabling flow (setup)
  const [enabling, setEnabling] = useState(false);
  const [setupToken, setSetupToken] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const data = await getMyProfile();
        if (alive) setMe(data || null);
      } catch (e) {
        if (alive) {
          setErr(e?.message || "Failed to load profile.");
          setMe(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function onResendVerify() {
    try {
      setActionMsg("");
      await resendVerificationEmail();
      setActionMsg("Verification email sent.");
    } catch (e) {
      setActionMsg(e?.response?.data?.detail || "Could not send verification email.");
    }
  }

  async function enable2FAStart() {
    try {
      setActionMsg("");
      setEnabling(true);
      const data = await start2FAEmailSetup();
      setSetupToken(data?.setup_token || "");
    } catch (e) {
      setEnabling(false);
      setActionMsg(e?.response?.data?.detail || "Could not start 2FA setup.");
    }
  }

  async function enable2FAConfirm(e) {
    e.preventDefault();
    try {
      const out = await confirm2FAEmailSetup({ code: setupCode, setupToken });
      if (out?.enabled) {
        setActionMsg("Two-factor authentication enabled.");
        const fresh = await getMyProfile().catch(() => null);
        if (fresh) setMe(fresh);
      } else {
        setActionMsg("Incorrect code. Try again.");
      }
      setEnabling(false);
      setSetupCode("");
      setSetupToken("");
    } catch (e2) {
      setActionMsg(e2?.response?.data?.detail || "Could not confirm 2FA setup.");
    }
  }

  async function disable2FA() {
    if (!confirm("Disable two-factor authentication?")) return;
    try {
      setActionMsg("");
      const out = await disable2FAEmail();
      if (out?.disabled) {
        setActionMsg("Two-factor authentication disabled.");
        const fresh = await getMyProfile().catch(() => null);
        if (fresh) setMe(fresh);
      } else {
        setActionMsg("Could not disable 2FA.");
      }
    } catch (e) {
      setActionMsg(e?.response?.data?.detail || "Could not disable 2FA.");
    }
  }

  if (loading) {
    return (
      <div className="container py-4">
        <div className="glass p-4">Loading…</div>
      </div>
    );
  }
  if (err || !me) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">{err || "Could not load profile."}</div>
      </div>
    );
  }

  const emailVerified = !!me.email_verified;
  const twoFAEnabled = !!me.two_factor_enabled;

  return (
    <div className="container py-4">
      <div className="glass p-4">
        <h1 className="h4 mb-3">Profile</h1>

        <div className="d-flex align-items-center gap-3 mb-3">
          {me.avatar ? (
            <img
              src={mediaUrl(me.avatar)}
              alt={me.username || "Avatar"}
              className="rounded-circle profile-avatar"
            />
          ) : (
            <div className="rounded-circle profile-avatar-fallback">
              {me.username?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          <div>
            <div className="fw-bold">{me.full_name || me.username}</div>
            <div className="text-muted small">@{me.username}</div>
          </div>
        </div>

        {/* Email + verification */}
        <div className="security-section">
          <h2 className="h6 mb-2">Email</h2>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span>{me.email || "—"}</span>
            {emailVerified ? (
              <span className="badge bg-success-subtle text-success fw-semibold">Verified</span>
            ) : (
              <span className="badge bg-warning-subtle text-warning fw-semibold">Unverified</span>
            )}
            {!emailVerified && (
              <button className="btn btn-sm btn-outline-ghost" onClick={onResendVerify}>
                Resend verification
              </button>
            )}
          </div>
        </div>

        {/* 2FA (Email) */}
        <div className="security-section mt-4">
          <h2 className="h6 mb-2">Two-Factor Authentication</h2>

          {!emailVerified && (
            <div className="alert alert-warning">
              Verify your email first to enable 2FA.
            </div>
          )}

          {twoFAEnabled ? (
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="badge bg-info-subtle text-info fw-semibold">Enabled (email)</span>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={disable2FA}
                disabled={!emailVerified}
              >
                Disable 2FA
              </button>
            </div>
          ) : (
            <>
              {!enabling ? (
                <button
                  className="btn btn-sm btn-gradient"
                  onClick={enable2FAStart}
                  disabled={!emailVerified}
                >
                  Enable 2FA via email
                </button>
              ) : (
                <form className="verify-form mt-2" onSubmit={enable2FAConfirm}>
                  <label className="form-label small">
                    Enter the 6-digit code we sent to your email
                  </label>
                  <input
                    className="form-control wl-input"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value)}
                    placeholder="123456"
                    required
                  />
                  <div className="mt-2">
                    <button type="submit" className="btn btn-sm btn-gradient">Confirm</button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-ghost ms-2"
                      onClick={() => {
                        setEnabling(false);
                        setSetupToken("");
                        setSetupCode("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {actionMsg && <div className="text-success mt-3">{actionMsg}</div>}
      </div>
    </div>
  );
}