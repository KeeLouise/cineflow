import { Navigate } from "react-router-dom";
import { safeLocalStorage } from "@/api/auth";

export default function PrivateRoute({ children }) {
    const token = safeLocalStorage.getItem("access");

    //if no token, kick user back to login - KR 20/08/2025
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    //Otherwise render the protected page - KR 20/08/2025
    return children;
}