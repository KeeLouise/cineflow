import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/Client";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [ready, setReady] = useState(false);

    //On 1st load if access token is present, try protected endpoint to confirm validation - KR 18/08/2025
    useEffect(() => {
      const token = localStorage.getItem("access");
      if (!token) {
        setReady (true);
        return;
      }
      api.get("/secure/") //Protected test endpoint in Django - KR 18/08/2025
        .then((res) => setUser({ username: res.data.user }))
        .catch(() => {
            //Token invalid/expired - clear and treat as logged out. KR 18/08/2025
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
        })
        .finally(() => setReady(true));
    }, []);
    
    //Called after a sucessful /api/token/ login - KR 18/08/2025
    const login = ({ access, refresh, username }) => {
        localStorage.setItem("access", access);
        localStorage.setItem("refresh", refresh);
        setUser(null);
    };

    return (
        <AuthCtx.Provider value={{ user, ready, login, logout}}>
            {children}
        </AuthCtx.Provider>
    
);
}