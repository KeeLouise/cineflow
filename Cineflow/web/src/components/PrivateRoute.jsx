import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "@/api/auth";

export default function PrivateRoute({ children }) {
  const [allowed, setAllowed] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await isAuthenticated(); // will try silent refresh if needed
      if (alive) setAllowed(ok);
    })();
    return () => { alive = false; };
  }, []);

  if (allowed === null) {
    return (
      <div className="container py-5 text-center">
        <div className="glass p-4">Checking session…</div>
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}