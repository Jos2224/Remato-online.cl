import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PageLoader } from "./States";

export function ProtectedRoute({ children, userOnly = false }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Revisando tu sesión" />;
  if (!isAuthenticated) return <Navigate to="/ingresar" replace state={{ from: location }} />;
  if (userOnly && user?.role !== "user") return <Navigate to="/cuenta" replace />;
  return children;
}
