import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import App from "@/App";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Watchlists from "@/pages/Watchlists";
import WatchlistDetail from "@/pages/WatchlistDetail";
import Rooms from "@/pages/Rooms";
import RoomDetail from "@/pages/RoomDetail";
import Profile from "@/pages/Profile";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@/styles/base.css";
import PrivateRoute from "@/components/PrivateRoute";
import AuthProvider from "@/auth/AuthContext"; 

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },

      {
        element: <PrivateRoute />,
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/watchlists", element: <Watchlists /> },
          { path: "/watchlists/:id", element: <WatchlistDetail /> },
          { path: "/rooms", element: <Rooms /> },
          { path: "/rooms/:id", element: <RoomDetail /> },
          { path: "/profile", element: <Profile /> },
        ],
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
