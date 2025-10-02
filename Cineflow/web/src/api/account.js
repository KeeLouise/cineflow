import api from "@/api/client";


 // Email verification (account activation)
 export async function resendVerificationEmail() {
   try {
     const { data } = await api.post("/auth/resend_me/");
     return data; // { detail: "Verification email sent." }
   } catch (e) {
     const status = e?.response?.status;
     const detail = e?.response?.data?.detail;
     // Backend returns 400 when the account is already verified.
     if (status === 400 && /already verified/i.test(String(detail || ""))) {
       return { detail }; // treat as non-fatal "you're already verified"
     }
     throw e;
   }
 }
A

// Email-based 2FA (simple enable/disable; login OTP is handled by /token/)
export async function enableEmail2FA() {
  const { data } = await api.post("/auth/2fa/email/enable/");
  return data; // { detail: "Email 2FA enabled." }
}

export async function disableEmail2FA() {
  const { data } = await api.post("/auth/2fa/email/disable/");
  return data; // { detail: "Email 2FA disabled." }
}

// Password Reset


export async function requestPasswordReset(email) {
  const { data } = await api.post("/auth/password/reset/", { email });
  return data;
}

export async function confirmPasswordReset({ token, password, password2 }) {
  const { data } = await api.post("/auth/password/reset/confirm/", {
    token, password, password2
  });
  return data; 
}