// minimal JWT helpers with expiry awareness - KR 02/09/2025

const ACCESS_KEY = "access";
const REFRESH_KEY = "refresh";

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
  return !!localStorage.getItem(ACCESS_KEY) || !!localStorage.getItem(REFRESH_KEY);
}

// public: authoritative check – verifies/refreshes if needed - KR 02/09/2025
export async function isAuthenticated() {
  const access = localStorage.getItem(ACCESS_KEY);
  if (access && !isExpired(access)) return true;

  // try silent refresh using refresh token - KR 02/09/2025
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return false;

  try {
    const res = await fetch("/api/token/refresh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) throw new Error("refresh failed");
    const data = await res.json();
    if (data?.access) {
      localStorage.setItem(ACCESS_KEY, data.access);
      return true;
    }
  } catch {
  }
  // hard sign out if refresh failed - KR 02/09/2025
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  return false;
}

export async function ensureSessionOrRedirect() {
  const ok = await isAuthenticated();
  if (!ok) window.location.href = "/login";
  return ok;
}

export function logout() { // logout function to remove access tokens - KR 21/08/2025
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  window.location.href = "/login";
}

/* token utilities + authFetch wrapper - KR 18/09/2025 */

// helpers to read/write tokens centrally - KR 18/09/2025
export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY) || "";
}
export function setTokens({ access, refresh } = {}) {
  if (typeof access === "string") localStorage.setItem(ACCESS_KEY, access);
  if (typeof refresh === "string") localStorage.setItem(REFRESH_KEY, refresh);
}

// Silent refresh (returns new access or null) - KR 18/09/2025
export async function refreshAccessToken() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch("/api/token/refresh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.access) {
      localStorage.setItem(ACCESS_KEY, data.access);
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

  let res = await fetch(url, { ...options, headers: initialHeaders });

  // If unauthorised, try once to refresh and retry the same request - KR 18/09/2025
  if (res.status === 401) {
    const newAccess = await refreshAccessToken();
    if (!newAccess) {
      return res;
    }
    const retryHeaders = new Headers(options.headers || {});
    retryHeaders.set("Authorization", `Bearer ${newAccess}`);
    res = await fetch(url, { ...options, headers: retryHeaders });
  }

  return res;
}
