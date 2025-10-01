import { Navigate, Outlet, useLocation } from "react-router-dom";
import { looksLoggedIn } from "@/api/auth";

export default function PrivateRoute() {
  const authed = looksLoggedIn(); 
  const location = useLocation();

  if (!authed) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}