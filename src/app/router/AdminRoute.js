import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

const AdminRoute = ({ children }) => {
  const { userData } = useAuth();
  const isAdmin = userData?.role?.toLowerCase() === "admin";

  return isAdmin ? children : <Navigate to="/dashboard" replace />;
};

export default AdminRoute;