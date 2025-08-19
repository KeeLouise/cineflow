import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function Dashboard() {
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // If no token in localStorage → redirect immediately - KR 19/08/2025
    const token = localStorage.getItem("access");
    if (!token) {
      navigate("/login");
      return;
    }

    // Try hitting secure API - KR 19/08/2025
    api.get("/secure/")
      .then(r => setMessage(r.data.message))
      .catch(err => {
        console.error("Secure API error:", err);

        // If unauthorized, clear tokens and redirect - KR 19/08/2025
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        navigate("/login");
      });
  }, [navigate]);

  return (
    <div className="container mt-5">
      <h1>📊 Dashboard</h1>
      <p>{message || "Loading..."}</p>
    </div>
  );
}