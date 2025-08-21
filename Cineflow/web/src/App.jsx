feature/footer
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";

feauture/navbar
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
 main
import Home from "./pages/Home.jsx";
import Navbar from "./components/Navbar";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
 feature/footer
import PrivateRoute from "./components/PrivateRoute.jsx";

import PrivateRoute from "./components/PrivateRoute";
import Footer from "./components/Footer";
 main

export default function App() {
  return (
    <div className="d-flex flex-column min-vh-100">
 feature/footer
      <Navbar />
      <main className="flex-grow-1">
        <Routes>
          {/* Home Page */}
          <Route path="/" element={<Home />} />
            
    <Navbar />
      <main className="flex-grow-1">
    
import { Routes, Route } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import PrivateRoute from "@/components/PrivateRoute";

export default function App() {
  return (
    <>
      <Navbar />
 main
      <Routes>
        <Route path="/" element={<Home />} />
 feauture/navbar
 main

          {/* Login Page */}
          <Route path="/login" element={<Login />} />

          {/* Registration Page */}
          <Route path="/register" element={<Register />} />

 feature/footer
          {/* Dashboard Page - Protected */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
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

        <Route path="/login" element={<Login />}/>
        <Route path="/register" element={<Register />}/>
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
      </Routes>
    </>
 main
 main
  );
}