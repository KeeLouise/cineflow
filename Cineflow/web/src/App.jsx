import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard.jsx";
import PrivateRoute from "./components/PrivateRoute";

export default function App() {
  return (
      <Routes>
        {/* Home Page */}
        <Route path="/" element={<Home />} />

        {/* Login Page */}
        <Route path="/login" element={<Login />} />

        {/* Registraton Page */}
        <Route path="/register" element={<Register />} /> 

        {/* Dashboard Page - Protected */}
        <Route path="/dashboard" element={<PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      } 
      />
      </Routes>
  );
}
