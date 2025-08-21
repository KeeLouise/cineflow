import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Navbar from "./components/Navbar";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard.jsx";
import PrivateRoute from "./components/PrivateRoute";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="d-flex flex-column min-vh-100">
    <Navbar />
      <main className="flex-grow-1">
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
      </main>
    <Footer />
    </div>
  );
}