import { useState } from "react";
import { setTokens } from "@/api/auth";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pwError, setPwError] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPwError("");

    if (password !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }

    try {
      await axios.post("/api/auth/register/", { username, email, password });

      // Do not auto-login: require verification first
      navigate("/verify-email?ok=pending");
    } catch (err) {
      console.error(err);
      setError("Registration failed. Try another username/email.");
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: 420 }}>
      <h2 className="mb-3">Register</h2>
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
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <input
            type="password"
            className={`form-control ${pwError ? "is-invalid" : ""}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Confirm Password</label>
          <input
            type="password"
            className={`form-control ${pwError ? "is-invalid" : ""}`}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (password && e.target.value !== password) {
                setPwError("Passwords do not match.");
              } else {
                setPwError("");
              }
            }}
            required
          />
          {pwError && <div className="invalid-feedback">{pwError}</div>}
        </div>
        <button className="btn btn-dark w-100">Sign Up</button>
      </form>
    </div>
  );
}