import api from "@/api/client";

// Email verification
export async function resendVerificationEmail() {
  const { data } = await api.post("/auth/email/resend/");
  return data; // { sent: true }
}

// 2FA
export async function start2FASetup() {
  const { data } = await api.post("/auth/2fa/setup/");
  return data;
}

export async function confirm2FA(code) {
  const payload = { code: String(code || "").trim() };
  if (!/^\d{6}$/.test(payload.code)) {
    throw new Error("Enter a 6-digit code.");
  }
  const { data } = await api.post("/auth/2fa/confirm/", payload);
  return data;
}

export async function disable2FA(code) {
  const payload = code ? { code: String(code || "").trim() } : {};
  const { data } = await api.post("/auth/2fa/disable/", payload);
  return data;
}