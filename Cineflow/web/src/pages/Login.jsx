import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { setTokens } from "@/api/auth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // relative path so Vite proxy forwards to Django - KR 19/08/2025
      const { data } = await axios.post("/api/token/", { username, password });

      setTokens({ access: data.access, refresh: data.refresh });

      navigate("/dashboard");
    } catch (err) {
      setError("Invalid credentials or server unreachable");
      console.error(err);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: 420 }}>
      <h2 className="mb-3">Login</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Username</label>
          <input
            className="form-control"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-dark w-100">Log In</button>
      </form>
    </div>
  );
}