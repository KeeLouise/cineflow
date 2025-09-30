// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "@/api/profile";
import { mediaUrl } from "@/utils/media";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    full_name: "",
    avatar: null,
  });

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");

  function normalizeProfile(p) {
    if (!p) return p;
    return {
      ...p,
      avatar: p.avatar ? `${mediaUrl(p.avatar)}?v=${Date.now()}` : null,
    };
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getMyProfile();
        if (!alive) return;
        const n = normalizeProfile(data);
        setForm({
          username: n.username || "",
          email: n.email || "",
          first_name: n.first_name || "",
          last_name: n.last_name || "",
          full_name: n.full_name || n.username || "",
          avatar: n.avatar || null,
        });
      } catch (e) {
        if (alive) setErr(e.message || "Failed to load profile.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  function onPickAvatar(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    if (f) setPreview(URL.createObjectURL(f)); else setPreview("");
    setOk(""); setErr("");
  }

  function splitDisplayName(display) {
    const s = (display || "").trim();
    if (!s) return { first_name: "", last_name: "" };
    const parts = s.split(/\s+/);
    const first = parts.shift() || "";
    const last = parts.join(" ");
    return { first_name: first, last_name: last };
  }

  async function onSave(e) {
    e.preventDefault();
    setErr(""); setOk("");
    setSaving(true);
    try {
      const nameParts = splitDisplayName(form.full_name);
      const payloadBase = {
        username: form.username,
        email: form.email,
        ...nameParts,
      };
      const payload = file ? { ...payloadBase, avatar: file } : payloadBase;

      const updatedRaw = await updateMyProfile(payload);
      const updated = normalizeProfile(updatedRaw);
      const bust = updated.avatar ? (updated.avatar.includes("?") ? "&" : "?") + "v=" + Date.now() : "";

      setForm({
        username: updated.username || "",
        email: updated.email || "",
        first_name: updated.first_name || "",
        last_name: updated.last_name || "",
        full_name: updated.full_name || updated.username || "",
        avatar: updated.avatar ? updated.avatar + bust : null,
      });

      if (preview) { URL.revokeObjectURL(preview); }
      setFile(null); setPreview("");

      window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...updated, avatar: updated.avatar ? updated.avatar + bust : null } }));
      setOk("Profile updated successfully.");
    } catch (e) {
      setErr(e.response?.data?.username?.[0] || e.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveAvatar() {
    if (!confirm("Remove your profile picture?")) return;
    setSaving(true); setErr(""); setOk("");
    try {
      const updatedRaw = await updateMyProfile({ remove_avatar: true });
      const updated = normalizeProfile(updatedRaw);
      setForm(f => ({
        ...f,
        avatar: null,
        username: updated.username || f.username,
        email: updated.email ?? f.email,
        first_name: updated.first_name ?? f.first_name,
        last_name: updated.last_name ?? f.last_name,
        full_name: updated.full_name || f.full_name,
      }));
      if (preview) { URL.revokeObjectURL(preview); setPreview(""); }
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...updated, avatar: null } }));
      setOk("Profile picture removed.");
    } catch (e) {
      setErr(e.message || "Failed to remove avatar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container py-4">
        <div className="glass p-4 text-center">Loading…</div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="glass p-3 mb-3">
        <h1 className="h4 m-0">Profile</h1>
      </div>

      {err && <div className="alert alert-danger glass">{err}</div>}
      {ok && <div className="alert alert-success glass">{ok}</div>}

      <form className="glass p-3" onSubmit={onSave}>
        <div className="mb-3">
          <label className="form-label">Username</label>
          <input
            className="form-control wl-input"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            maxLength={150}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control wl-input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            maxLength={254}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Display name</label>
          <input
            className="form-control wl-input"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            maxLength={300}
          />
          <div className="form-text text-muted">
            This is shown across the app. We’ll split it into first/last name.
          </div>
        </div>

        <div className="mt-4">
          <label className="form-label">Profile picture</label>
          <div className="d-flex align-items-center gap-3">
            {preview ? (
              <img src={preview} alt="preview" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover" }} />
            ) : form.avatar ? (
              <img src={form.avatar} alt="avatar" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover" }} />
            ) : (
              <div className="room-poster-placeholder" style={{ width: 72, height: 72, borderRadius: 12, display:"grid", placeItems:"center" }}>
                —
              </div>
            )}

            <div className="d-flex flex-column gap-2">
              <input type="file" accept="image/*" onChange={onPickAvatar} />
              {(form.avatar || preview) && (
                <button type="button" className="btn btn-outline-ghost btn-compact" onClick={onRemoveAvatar}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button className="btn btn-gradient" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}