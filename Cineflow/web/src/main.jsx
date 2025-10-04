import React from "react";
if (typeof window !== "undefined") {
window.React = window.React || React;
}
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
import MovieDetail from "@/pages/MovieDetail";
import SeeAllPage from "@/pages/SeeAllPage";
import VerifyEmail from "@/pages/VerifyEmail";
import PrivateRoute from "@/components/PrivateRoute";
import AuthProvider from "@/auth/AuthContext";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

import NotFound from "@/pages/NotFound";
import ServerError from "@/pages/ServerError";

const router = createBrowserRouter([
  {
    element: <App />,
    errorElement: <ServerError />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
      { path: "/movie/:id", element: <MovieDetail /> },
      { path: "/verify-email", element: <VerifyEmail /> },
      { path: "/forgot-password", element: <ForgotPassword /> },
      { path: "/reset-password", element: <ResetPassword /> },

      {
        element: <PrivateRoute />,
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/mood/:mood/see-all", element: <SeeAllPage /> },
          { path: "/watchlists", element: <Watchlists /> },
          { path: "/watchlists/:id", element: <WatchlistDetail /> },
          { path: "/rooms", element: <Rooms /> },
          { path: "/rooms/:id", element: <RoomDetail /> },
          { path: "/profile", element: <Profile /> },
        ],
      },

      { path: "*", element: <NotFound /> },
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