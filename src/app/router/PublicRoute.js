// 📁 app/router/PublicRoute.js
import { useAuth } from "@/features/auth/AuthContext";
import { Navigate } from "react-router-dom";

const PublicRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Navigate to="/" replace /> : children;
};

export default PublicRoute;
