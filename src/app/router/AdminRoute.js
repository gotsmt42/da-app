import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";

const AdminRoute = ({ children }) => {
  const { userData } = useAuth();
  const isAdmin = can(userData, "manageAll");

  return isAdmin ? children : <Navigate to="/dashboard" replace />;
};

export default AdminRoute;