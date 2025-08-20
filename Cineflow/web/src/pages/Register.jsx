import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Registration component for signing up new users - KR 20/08/2025
export default function Register() {
    // Local state for form fields - kr 20/08/2025
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(""); // to show error messages if signup fails - KR 20/08/2025
    
    const navigate = useNavigate(); // lets user redirect after successful registration - KR 20/08/2025

     // Called when form is submitted - KR 20/08/2025
    const handleSubmit = async (e) => {
        e.preventDefault(); // prevent page reload
        setError(""); // clear any previous error

        try {
            await axios.post("/api/register/", { username, email, password});
            // after signup, log user in automatically - KR 20/08/2025
            const { data } = await axios.post("/api/token/", { username, password, });

            localStorage.setItem("access", data.access);
            localStorage.setItem("refresh", data.refresh);

            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            setError("Registration failed. Try another username/email.");
        }
    };

    return(
         <div className="container mt-5" style={{ maxWidth: 420 }}>
      <h2 className="mb-3">Register</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Username</label>
          <input className="form-control" value={username}
                 onChange={(e)=>setUsername(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input type="email" className="form-control" value={email}
                 onChange={(e)=>setEmail(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <input type="password" className="form-control" value={password}
                 onChange={(e)=>setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-dark w-100">Sign Up</button>
      </form>
    </div>
  );
}