import api from "./client";

export async function getMyProfile() {
  const { data } = await api.get("/me/profile/");
  return data;
}

export async function updateMyProfile(patch) {
  const hasFile =
    patch &&
    (patch.avatar instanceof File ||
      (typeof Blob !== "undefined" && patch.avatar instanceof Blob));

  if (hasFile || patch?.remove_avatar) {
    const fd = new FormData();
    if (patch.username != null)   fd.append("username", patch.username);
    if (patch.email != null)      fd.append("email", patch.email);
    if (patch.first_name != null) fd.append("first_name", patch.first_name);
    if (patch.last_name != null)  fd.append("last_name", patch.last_name);
    if (hasFile) fd.append("avatar", patch.avatar);
    if (patch.remove_avatar) fd.append("remove_avatar", "1");
    const { data } = await api.patch("/me/profile/", fd);
    return data;
  }

  const { data } = await api.patch("/me/profile/", patch);
  return data;
}