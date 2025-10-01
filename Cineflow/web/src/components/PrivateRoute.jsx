import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/api/auth";

export default function PrivateRoute() {
  const [status, setStatus] = useState("checking");
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ok = await isAuthenticated();
        if (alive) setStatus(ok ? "ok" : "fail");
      } catch {
        if (alive) setStatus("fail");
      }
    })();
    return () => { alive = false; };
  }, []);

  if (status === "checking") return null;
  if (status === "fail") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}