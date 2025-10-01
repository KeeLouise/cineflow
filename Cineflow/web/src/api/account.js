import api from "@/api/client";

// Email verification (account activation)
export async function resendVerificationEmail() {
  const { data } = await api.post("/auth/email/resend/");
  return data; // { sent: true }
}

// Email-based 2FA

// Start enabling 2FA via email. Backend emails a code and returns a temporary setup token.
export async function start2FAEmailSetup() {
  const { data } = await api.post("/auth/2fa/email/setup/start/");
  return data; // { setup_token }
}

// Confirm enabling 2FA by submitting the emailed code and the setup token.
export async function confirm2FAEmailSetup({ code, setupToken }) {
  const { data } = await api.post("/auth/2fa/email/setup/confirm/", {
    code: String(code || "").trim(),
    setup_token: String(setupToken || "").trim(),
  });
  return data; // { enabled: true }
}

// Disable email 2FA
export async function disable2FAEmail() {
  const { data } = await api.post("/auth/2fa/email/disable/");
  return data; // { disabled: true }
}

// Confirm the login-time MFA challenge using the code sent to email.
export async function confirm2FAEmailLogin({ code, mfaToken }) {
  const { data } = await api.post("/auth/2fa/email/confirm/", {
    code: String(code || "").trim(),
    mfa_token: String(mfaToken || "").trim(),
  });
  return data; 
}