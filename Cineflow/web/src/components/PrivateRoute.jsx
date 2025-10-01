import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "@/api/client";
import { safeLocalStorage } from "@/api/auth";

export default function PrivateRoute({ children }) {
  const location = useLocation();
  const token = safeLocalStorage.getItem("access");

  // no token -> go to login immediately
  if (!token) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // check: verify token actually works with the backend
  const [status, setStatus] = useState<"checking" | "ok" | "fail">("checking");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await api.get("/me/profile/");
        if (alive) setStatus("ok");
      } catch {
        if (alive) setStatus("fail");
      }
    })();
    return () => { alive = false; };
  }, []);

  if (status === "checking") {
    return (
      <div className="container py-5 text-center">
        <div className="glass p-4">Checking your session…</div>
      </div>
    );
  }

  if (status === "fail") {
    // Bad/expired token or MFA not completed -> back to login
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return children;
}