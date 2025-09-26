import { Routes, Route, Navigate } from "react-router-dom";
import "@/styles/base.css";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import SeeAllPage from "@/pages/SeeAllPage.jsx";
import Footer from "./components/Footer.jsx";
import PrivateRoute from "@/components/PrivateRoute";
import MovieDetail from "@/pages/MovieDetail.jsx";
import Watchlists from "@/pages/Watchlists.jsx";
import WatchlistDetail from "@/pages/WatchlistDetail.jsx";

export default function App() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <main className="flex-grow-1 w-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected pages */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/mood/:mood/see-all"
            element={
              <PrivateRoute>
                <SeeAllPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/watchlists"
            element={
              <PrivateRoute>
                <Watchlists />
              </PrivateRoute>
            }
          />

          <Route
            path="/watchlists/:id"
            element={
              <PrivateRoute>
                <WatchlistDetail />
              </PrivateRoute>
            }
          />

          <Route path="/movie/:id" element={<MovieDetail />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
