import { Routes, Route } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Footer from "./components/Footer.jsx";
import PrivateRoute from "@/components/PrivateRoute";
import MovieDetail from "@/pages/MovieDetail.jsx";

export default function App() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <main className="flex-grow-1 w-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>}/>
          <Route path="/movie/:id" element={<MovieDetail />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
