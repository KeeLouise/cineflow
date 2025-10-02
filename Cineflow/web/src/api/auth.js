// minimal JWT helpers with expiry awareness - KR 02/09/2025

const ACCESS_KEY = "access";
const REFRESH_KEY = "refresh";

// Email 2FA–aware login helper 

import API_ROOT from "@/utils/apiRoot";

export async function loginAttempt({ username, password, otp } = {}) {
  const body = { username, password };
  if (otp) body.otp = otp;

  const res = await fetch(`${API_ROOT}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok) {
    // success: persist tokens the same way the rest of your app expects
    if (data?.access || data?.refresh) {
      setTokens({ access: data.access, refresh: data.refresh });
    }
    return { ok: true, data };
  }

  // 400 from server with an OTP hint means "OTP required" or "invalid/expired OTP"
  if (data?.otp) {
    return {
      ok: false,
      otpRequired: true,
      message: Array.isArray(data.otp) ? data.otp[0] : String(data.otp),
    };
  }

  // generic error
  return {
    ok: false,
    message: data?.detail || "Invalid credentials.",
  };
}

//wrapper in case window/localstorage is not available - KR 25/09/2025
export const safeLocalStorage =
  typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      };

// small helper to notify the app when auth state changes - KR 24/09/2025
function emitAuthChanged() {
  if (typeof window !== "undefined" && window?.dispatchEvent) {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

function parseJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isExpired(token, skewSeconds = 20) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= (now + skewSeconds);
}

// public: boolean used by Navbar to toggle links - KR 02/09/2025
export function looksLoggedIn() {
  return !!safeLocalStorage.getItem(ACCESS_KEY) || !!safeLocalStorage.getItem(REFRESH_KEY);
}

// public: authoritative check – verifies/refreshes if needed - KR 02/09/2025
import API_ROOT from "@/utils/apiRoot";
export async function isAuthenticated() {
  const access = safeLocalStorage.getItem(ACCESS_KEY);
  if (access && !isExpired(access)) return true;

  // try silent refresh using refresh token - KR 02/09/2025
  const refresh = safeLocalStorage.getItem(REFRESH_KEY);
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_ROOT}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) throw new Error("refresh failed");
    const data = await res.json();
    if (data?.access) {
      safeLocalStorage.setItem(ACCESS_KEY, data.access);
      emitAuthChanged();
      return true;
    }
  } catch {
  }
  // hard sign out if refresh failed - KR 02/09/2025
  safeLocalStorage.removeItem(ACCESS_KEY);
  safeLocalStorage.removeItem(REFRESH_KEY);
  emitAuthChanged();
  return false;
}

export async function ensureSessionOrRedirect() {
  const ok = await isAuthenticated();
  if (!ok) window.location.href = "/login";
  return ok;
}

export function logout() { // logout function to remove access tokens - KR 21/08/2025
  safeLocalStorage.removeItem(ACCESS_KEY);
  safeLocalStorage.removeItem(REFRESH_KEY);
  emitAuthChanged();
  window.location.href = "/login";
}

/* token utilities + authFetch wrapper - KR 18/09/2025 */

// helpers to read/write tokens centrally - KR 18/09/2025
export function getAccessToken() {
  return safeLocalStorage.getItem(ACCESS_KEY) || "";
}
export function setTokens({ access, refresh } = {}) {
  if (typeof access === "string") safeLocalStorage.setItem(ACCESS_KEY, access);
  if (typeof refresh === "string") safeLocalStorage.setItem(REFRESH_KEY, refresh);
  emitAuthChanged(); // <— notify listeners after setting tokens
}

// Silent refresh (returns new access or null) - KR 18/09/2025
export async function refreshAccessToken() {
  const refresh = safeLocalStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_ROOT}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.access) {
      safeLocalStorage.setItem(ACCESS_KEY, data.access);
      emitAuthChanged();
      return data.access;
    }
  } catch (e) {
    console.warn("Token refresh failed", e);
  }
  return null;
}

export async function authFetch(url, options = {}) {
  const initialHeaders = new Headers(options.headers || {});
  const access = getAccessToken();
  if (access) initialHeaders.set("Authorization", `Bearer ${access}`);

  let full = url;
  if (url.startsWith("/api/")) {
    full = `${API_ROOT}${url.replace(/^\/api/, "")}`;
  }

  let res = await fetch(full, { ...options, headers: initialHeaders });

  // If unauthorised, try once to refresh and retry the same request - KR 18/09/2025
  if (res.status === 401) {
    const newAccess = await refreshAccessToken();
    if (!newAccess) {
      return res;
    }
    const retryHeaders = new Headers(options.headers || {});
    retryHeaders.set("Authorization", `Bearer ${newAccess}`);
    res = await fetch(full, { ...options, headers: retryHeaders });
  }

  return res;
}
