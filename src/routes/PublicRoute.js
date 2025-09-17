// 📁 routes/PublicRoute.js
import { useAuth } from "../auth/AuthContext";
import { Navigate } from "react-router-dom";

const PublicRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Navigate to="/" replace /> : children;
};

export default PublicRoute;
