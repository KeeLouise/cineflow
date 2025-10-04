import api from "./client";

export async function getMyProfile() {
  const { data } = await api.get("/me/profile/");
  return data;
}

export async function updateMyProfile(patch = {}) {
  // Detect any binary in the payload
  const hasBinary = Object.values(patch).some(
    (v) => (typeof File !== "undefined" && v instanceof File) ||
           (typeof Blob !== "undefined" && v instanceof Blob)
  );

  if (hasBinary || patch.remove_avatar) {
    const fd = new FormData();

    if (patch.username != null)   fd.append("username", patch.username);
    if (patch.email != null)      fd.append("email", patch.email);
    if (patch.first_name != null) fd.append("first_name", patch.first_name);
    if (patch.last_name != null)  fd.append("last_name", patch.last_name);

    if (patch.avatar instanceof File || patch.avatar instanceof Blob) {
      fd.append("avatar", patch.avatar);
    }

    // Server-side boolean flags as strings
    if (patch.remove_avatar) {
      fd.append("remove_avatar", "true");
    }

    const { data } = await api.patch("/me/profile/", fd);
    return data;
  }

  // JSON PATCH for non-file updates
  const { data } = await api.patch("/me/profile/", patch);
  return data;
}