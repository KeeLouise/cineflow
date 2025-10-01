import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

const ACCESS_KEY = "access";

export default function ProtectedRoute() {
  const { ready } = useAuth();

  if (!ready) return null;

  let hasAccess = false;
  try { hasAccess = !!localStorage.getItem(ACCESS_KEY); } catch { hasAccess = false; }

  return hasAccess ? <Outlet /> : <Navigate to="/login" replace />;
}