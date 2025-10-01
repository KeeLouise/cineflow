import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "@/api/auth";

export default function PrivateRoute({ children }) {
  const [status, setStatus] = useState("checking");
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ok = await isAuthenticated();
        if (!alive) return;
        setStatus(ok ? "ok" : "fail");
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
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}