// src/pages/Profile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getMyProfile, updateMyProfile } from "@/api/profile";
import api from "@/api/client";
import { extractErr } from "@/utils/errors"; // <-- tiny helper that unpacks API errors
import "@/styles/security.css";

// Email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export default function Profile() {
  const [me, setMe] = useState(null);

  // Avatar handling
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [resendMsg, setResendMsg] = useState("");

  // 2FA UI
  const [twoFaMsg, setTwoFaMsg] = useState("");
  const [twoFaError, setTwoFaError] = useState("");

  // Email validation
  const [emailTouched, setEmailTouched] = useState(false);
  const emailInvalid = emailTouched && me?.email && !emailRegex.test(me.email || "");

  // Bust avatar caches using updated_at
  const version = useMemo(() => {
    if (!me?.updated_at) return Date.now();
    const t = Date.parse(me.updated_at);
    return Number.isFinite(t) ? t : Date.now();
  }, [me?.updated_at]);

  // Server avatar URL (absolute or /media/...) with ?v=
  const avatarUrl = useMemo(() => {
    if (!me?.avatar) return "";
    try {
      const u = new URL(me.avatar, window.location.origin);
      u.searchParams.set("v", String(version));
      return u.toString();
    } catch {
      const sep = me.avatar.includes("?") ? "&" : "?";
      return `${me.avatar}${sep}v=${version}`;
    }
  }, [me?.avatar, version]);

  // Local preview during upload
  const localPreview = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : ""),
    [avatarFile]
  );

  // Load current profile
  useEffect(() => {
    (async () => {
      try {
        const data = await getMyProfile();
        setMe(data);
      } catch (e) {
        setError(extractErr(e) || "Could not load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Revoke preview URL when file changes/unmounts
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function handleSave(e) {
    e.preventDefault();
    if (!me) return;

    if (me.email && !emailRegex.test(me.email)) {
      setEmailTouched(true);
      setError("Please enter a valid email address.");
      return;
    }

    setSaving(true);
    setError("");
    setOkMsg("");

    try {
      // Only send fields that are strings / present
      const patch = {};
      if (typeof me.username === "string")    patch.username = me.username;
      if (typeof me.first_name === "string")  patch.first_name = me.first_name;
      if (typeof me.last_name === "string")   patch.last_name = me.last_name;
      if (typeof me.email === "string")       patch.email = (me.email || "").trim().toLowerCase();
      if (removeAvatar)                       patch.remove_avatar = true;

      const updated = await updateMyProfile(patch);
      setMe(updated);
      setOkMsg("Profile updated.");
      setRemoveAvatar(false);
    } catch (err) {
      setError(extractErr(err) || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    setError("");
    setOkMsg("");
    setTwoFaError("");
    setTwoFaMsg("");

    setAvatarFile(file);      // show local preview immediately
    setRemoveAvatar(false);

    try {
      const updated = await updateMyProfile({ avatar: file });
      setMe(updated);
      setOkMsg("Avatar updated.");

      // Clear local preview only on success
      setAvatarFile(null);
    } catch (err) {
      setError(extractErr(err) || "Could not upload avatar.");
      // keep preview so the user can retry
    }
  }

  async function handleResendVerify() {
    setResendMsg("");
    setError("");
    try {
      await api.post("/auth/resend_me/", {});
      setResendMsg("Verification email sent! Check your inbox.");
    } catch (e) {
      setError(extractErr(e) || "Could not resend verification email.");
    }
  }

  async function enable2FA() {
    setTwoFaMsg(""); setTwoFaError("");
    try {
      await api.post("/auth/2fa/email/enable/");
      setTwoFaMsg("Email 2FA enabled. You’ll be asked for a code on next sign-in.");
      setMe((m) => ({ ...m, two_factor_enabled: true }));
    } catch (e) {
      setTwoFaError(extractErr(e) || "Could not enable 2FA.");
    }
  }

  async function disable2FA() {
    setTwoFaMsg(""); setTwoFaError("");
    try {
      await api.post("/auth/2fa/email/disable/");
      setTwoFaMsg("Email 2FA disabled.");
      setMe((m) => ({ ...m, two_factor_enabled: false }));
    } catch (e) {
      setTwoFaError(extractErr(e) || "Could not disable 2FA.");
    }
  }

  if (loading) return <div className="container py-4">Loading…</div>;

  const imgSrc = localPreview || avatarUrl;
  const initials = (me?.username?.trim()?.charAt(0)?.toUpperCase() || "U");

  return (
    <div className="container py-4">
      <h1 className="h4 mb-3">My Profile</h1>

      {error && <div className="alert alert-danger">{error}</div>}
      {okMsg && <div className="alert alert-success">{okMsg}</div>}
      {resendMsg && <div className="alert alert-success">{resendMsg}</div>}

      {/* Email not verified banner */}
      {me && !me.email_verified && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center">
          <span>Your email is not verified.</span>
          <button className="btn btn-sm btn-outline-dark" onClick={handleResendVerify}>
            Resend verification
          </button>
        </div>
      )}

      {me && (
        <>
          <form onSubmit={handleSave} className="glass security-card p-3 mb-4">
            {/* Username */}
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input
                className="form-control"
                value={me.username || ""}
                onChange={(e) => setMe({ ...me, username: e.target.value })}
                autoComplete="username"
              />
            </div>

            {/* Email */}
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                className={`form-control ${emailInvalid ? "is-invalid" : ""}`}
                value={me.email || ""}
                onChange={(e) => {
                  setMe({ ...me, email: e.target.value });
                  if (!emailTouched) setEmailTouched(true);
                }}
                onBlur={() => setEmailTouched(true)}
                autoComplete="email"
              />
              {emailInvalid && (
                <div className="invalid-feedback">Please enter a valid email address.</div>
              )}
            </div>

            {/* First/Last name */}
            <div className="mb-3">
              <label className="form-label">First Name</label>
              <input
                className="form-control"
                value={me.first_name || ""}
                onChange={(e) => setMe({ ...me, first_name: e.target.value })}
                autoComplete="given-name"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Last Name</label>
              <input
                className="form-control"
                value={me.last_name || ""}
                onChange={(e) => setMe({ ...me, last_name: e.target.value })}
                autoComplete="family-name"
              />
            </div>

            {/* Avatar preview */}
            <div className="mb-2">
              <label className="form-label d-block">Avatar</label>
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt="Avatar"
                  className="rounded-circle" // Bootstrap round
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src =
                      "https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=" +
                      encodeURIComponent(me.username || "User");
                  }}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
              ) : (
                <div
                  className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center"
                  style={{ width: 88, height: 88 }}
                  aria-label="Avatar"
                >
                  {initials}
                </div>
              )}
            </div>

            {/* Avatar choose/remove */}
            <div className="mb-3">
              <label className="form-label">Change Avatar</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={onFileChange}
              />

              {me.avatar && !avatarFile && (
                <div className="form-check mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="removeAvatar"
                    checked={removeAvatar}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      setRemoveAvatar(checked);
                      if (checked) {
                        try {
                          const updated = await updateMyProfile({ remove_avatar: true });
                          setMe(updated);
                          setOkMsg("Avatar removed.");
                        } catch (err) {
                          setError(extractErr(err) || "Could not remove avatar.");
                          setRemoveAvatar(false);
                        }
                      }
                    }}
                  />
                  <label className="form-check-label" htmlFor="removeAvatar">
                    Remove current avatar
                  </label>
                </div>
              )}
            </div>

            <button className="btn btn-gradient" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>

          {/* 2FA Section */}
          <div className="glass security-card p-3">
            <h2 className="h5">Two-Factor Authentication</h2>
            <p className="text-muted mb-2">
              Email 2FA adds a 6-digit code step when you sign in. You’ll receive the code at your email.
            </p>
            {twoFaError && <div className="alert alert-danger">{twoFaError}</div>}
            {twoFaMsg && <div className="alert alert-info">{twoFaMsg}</div>}

            {!me.two_factor_enabled ? (
              <button className="btn btn-outline-dark mt-2" onClick={enable2FA}>
                Enable Email 2FA
              </button>
            ) : (
              <button className="btn btn-danger mt-2" onClick={disable2FA}>
                Disable 2FA
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}