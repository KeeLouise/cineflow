
import api from "./client";

export async function getMyProfile() {
  const { data } = await api.get("/me/profile/");
  return data;
}

export async function updateMyProfile(patch) {
  const hasFile = patch && patch.avatar instanceof File;
  if (hasFile) {
    const fd = new FormData();
    if (patch.username != null) fd.append("username", patch.username);
    if (patch.email != null) fd.append("email", patch.email);
    if (patch.first_name != null) fd.append("first_name", patch.first_name);
    if (patch.last_name != null) fd.append("last_name", patch.last_name);
    fd.append("avatar", patch.avatar);
    const { data } = await api.patch("/me/profile/", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.patch("/me/profile/", patch);
  return data;
}