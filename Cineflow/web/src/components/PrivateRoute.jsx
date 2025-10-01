import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { safeLocalStorage } from "@/api/auth";


let useAuth;
try {
  ({ useAuth } = require("@/auth/AuthContext"));
} catch {
  useAuth = null;
}

export default function PrivateRoute({ children }) {
  const location = useLocation();

  let ready = true;
  let authed = !!safeLocalStorage.getItem("access");

  if (typeof useAuth === "function") {
    try {
      const ctx = useAuth();
      if (ctx) {
        ready = ctx.ready ?? true;
        authed = ctx.authed ?? authed;
      }
    } catch {
    }
  }

  if (!ready) {
    return (
      <div className="container py-5 text-center">
        <div className="glass p-4">Checking your session…</div>
      </div>
    );
  }

  if (!authed) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}