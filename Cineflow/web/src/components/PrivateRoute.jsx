import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children }) {
    const token = localStorage.getItem("access");

    //if no token, kick user back to login - KR 20/08/2025
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    //Otherwise render the protected page - KR 20/08/2025
    return children;
}