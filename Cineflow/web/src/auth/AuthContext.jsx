import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/api/client";            
import { getMyProfile } from "@/api/profile";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const ACCESS_KEY = "access";
const REFRESH_KEY = "refresh";

function hasToken() {
  try {
    return !!localStorage.getItem(ACCESS_KEY);
  } catch {
    return false;
  }
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const clearTokens = useCallback(() => {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {}
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await getMyProfile();
      if (data && typeof data === "object") {
        setUser(data);
        return data;
      }
    } catch {
      
      clearTokens();
      setUser(null);
    }
    return null;
  }, [clearTokens]);

  // if there is an access token, try to load profile.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!hasToken()) {
        if (alive) {
          setUser(null);
          setReady(true);
        }
        return;
      }
      await refreshProfile();
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [refreshProfile]);

  // Called right after a successful POST /api/token/ (or after MFA completion)
  const login = useCallback(async ({ access, refresh }) => {
    try {
      if (access) localStorage.setItem(ACCESS_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    } catch {}
    // load user profile to populate navbar etc.
    await refreshProfile();
    // let listeners (e.g., Navbar) update
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth-changed"));
    }
  }, [refreshProfile]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth-changed"));
    }
  }, [clearTokens]);

  const value = {
    user,          // profile object or null
    ready,         // context initialized
    login,         // ({ access, refresh }) -> stores tokens + loads profile
    logout,        // clears storage + resets user
    refreshProfile // optional: pages can force-refresh after saving profile
  };

  return (
    <AuthCtx.Provider value={value}>
      {children}
    </AuthCtx.Provider>
  );
}