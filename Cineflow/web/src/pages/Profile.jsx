import React, { useEffect, useMemo, useState } from "react";
import api from "@/api/client"; // axios instance with auth headers
import "@/styles/security.css";

// Email validation
const emailRegex =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

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
  const emailInvalid = emailTouched && me?.email && !emailRegex.test(me.email);

  // Live preview for newly avatar
  const previewSrc = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : me?.avatar || ""),
    [avatarFile, me?.avatar]
  );

  // Fetch current profile
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/me/profile/");
        setMe(data);
      } catch {
        setError("Could not load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (avatarFile) URL.revokeObjectURL(previewSrc);
    };
  }, [avatarFile, previewSrc]);

  async function handleSave(e) {
    e.preventDefault();
    if (!me) return;

    // client-side email validation gate
    if (me.email && !emailRegex.test(me.email)) {
      setEmailTouched(true);
      setError("Please enter a valid email address.");
      return;
    }

    setSaving(true);
    setError("");
    setOkMsg("");

    try {
      if (avatarFile || removeAvatar) {
        const fd = new FormData();
        if (me.username != null) fd.append("username", me.username);
        if (me.first_name != null) fd.append("first_name", me.first_name);
        if (me.last_name != null) fd.append("last_name", me.last_name);
        if (me.email != null) fd.append("email", me.email);
        if (avatarFile) fd.append("avatar", avatarFile);
        if (removeAvatar) fd.append("remove_avatar", "1");

        const { data } = await api.patch("/me/profile/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMe(data);
        setAvatarFile(null);
        setRemoveAvatar(false);
      } else {
        const payload = {
          username: me.username,
          first_name: me.first_name,
          last_name: me.last_name,
          email: me.email,
        };
        const { data } = await api.patch("/me/profile/", payload);
        setMe(data);
      }

      setOkMsg("Profile updated.");
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        Object.values(err?.response?.data || {})?.[0]?.[0] ||
        "Could not update profile.";
      setError(String(detail));
    } finally {
      setSaving(false);
    }
  }

  async function handleResendVerify() {
    setResendMsg("");
    setError("");
    try {
      await api.post("/auth/resend_me/", {});
      setResendMsg("Verification email sent! Check your inbox.");
    } catch {
      setError("Could not resend verification email.");
    }
  }

  // Email 2FA enable/disable
  async function enable2FA() {
    setTwoFaMsg(""); setTwoFaError("");
    try {
      await api.post("/auth/2fa/email/enable/");
      setTwoFaMsg("Email 2FA enabled. You’ll be asked for a code on next sign-in.");
      setMe((m) => ({ ...m, two_factor_enabled: true }));
    } catch (e) {
      const d = e?.response?.data?.detail || "Could not enable 2FA.";
      setTwoFaError(d);
    }
  }
  async function disable2FA() {
    setTwoFaMsg(""); setTwoFaError("");
    try {
      await api.post("/auth/2fa/email/disable/");
      setTwoFaMsg("Email 2FA disabled.");
      setMe((m) => ({ ...m, two_factor_enabled: false }));
    } catch (e) {
      const d = e?.response?.data?.detail || "Could not disable 2FA.";
      setTwoFaError(d);
    }
  }

  if (loading) return <div className="container py-4">Loading…</div>;

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
          {/* Profile form */}
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

            {/* Email with client validation */}
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                className={`form-control ${emailInvalid ? "is-invalid" : ""}`}
                value={me.email || ""}
                onChange={(e) => {
                  setMe({ ...me, email: e.target.value });
                  if (emailTouched) {
                    
                  }
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
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt="Avatar"
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
              ) : (
                <div className="text-muted" style={{ fontSize: 14 }}>
                  No avatar
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
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setAvatarFile(f);
                  if (f) setRemoveAvatar(false);
                }}
              />
              {me.avatar && !avatarFile && (
                <div className="form-check mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="removeAvatar"
                    checked={removeAvatar}
                    onChange={(e) => {
                      setRemoveAvatar(e.target.checked);
                      if (e.target.checked) setAvatarFile(null);
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