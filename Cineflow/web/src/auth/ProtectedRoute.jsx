import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

//Protected route - KR 18/08/2025
export default function ProtectedRoute() {
    const { user, ready } = useAuth();

    //Avoid flicker: wait until AuthContext finishes checking localStorage/token. KR 18/08/2025
    if (!ready) return null; 

    //If logged in, render nested route via 'Outlet'; otherwise go to 'login'. KR 18/08/2025
    return user ? <Outlet /> : <Navigate to="/login" replace />;
}