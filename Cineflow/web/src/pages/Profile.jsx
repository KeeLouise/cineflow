import React, { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "@/api/profile";
import { resendVerificationEmail } from "@/api/account";
import "@/styles/security.css";

export default function Profile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // editable fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMyProfile();
        setMe(data);
        setUsername(data.username || "");
        setEmail(data.email || "");
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
      } catch (err) {
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const form = new FormData();
      form.append("username", username);
      form.append("email", email);
      form.append("first_name", firstName);
      form.append("last_name", lastName);
      if (avatarFile) form.append("avatar", avatarFile);

      const updated = await updateMyProfile(form); 
      setMe(updated);
      setMessage("Profile updated successfully!");
    } catch (err) {
      setError(err.message || "Could not update profile.");
    }
  }

  async function handleResend() {
    setError("");
    setMessage("");
    try {
      await resendVerificationEmail();
      setMessage("Verification email sent! Check your inbox.");
    } catch (err) {
      setError(err.message || "Could not resend verification email.");
    }
  }

  if (loading) {
    return <div className="container py-5">Loading profile…</div>;
  }

  return (
    <div className="container py-4 security-page">
      <div className="glass security-card">
        <h1 className="h4 mb-3">My Profile</h1>

        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <form onSubmit={handleSave}>
          <div className="mb-3">
            <label className="form-label">Username</label>
            <input
              className="form-control wl-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control wl-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {!me?.email_verified && (
              <button
                type="button"
                className="btn btn-outline-ghost mt-2"
                onClick={handleResend}
              >
                Resend Verification Email
              </button>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label">First name</label>
            <input
              className="form-control wl-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Last name</label>
            <input
              className="form-control wl-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Avatar</label>
            <input
              type="file"
              className="form-control"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files[0] || null)}
            />
            {me?.avatar && (
              <div className="mt-2">
                <img
                  src={me.avatar}
                  alt="Avatar"
                  style={{ width: 80, height: 80, borderRadius: "50%" }}
                />
              </div>
            )}
          </div>

          <button className="btn btn-gradient" type="submit">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}