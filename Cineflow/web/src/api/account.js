import api from "@/api/client";

// Email verification
export async function resendVerificationEmail() {
  const { data } = await api.post("/auth/email/resend/");
  return data; // { sent: true }
}

// 2FA (MFA)
export async function start2FASetup() {
  const { data } = await api.post("/auth/2fa/setup/");
  return data; // { qr_svg, secret } (or similar)
}

export async function confirm2FA({ code, mfaToken }) {
  const { data } = await api.post("/auth/2fa/confirm/", {
    code: String(code || "").trim(),
    mfa_token: String(mfaToken || "").trim(),
  });
  return data;
}

export async function disable2FA(code) {
  const payload = code ? { code: String(code || "").trim() } : {};
  const { data } = await api.post("/auth/2fa/disable/", payload);
  return data;
}