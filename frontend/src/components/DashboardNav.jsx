import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function DashboardNav() {
  const { user } = useAuth();
  const canTrade = user?.role === "user";
  return (
    <nav className="dashboard-nav" aria-label="Secciones de la cuenta">
      <NavLink to="/cuenta">Saldo y movimientos</NavLink>
      {canTrade && <NavLink to="/mis-pujas">Mis pujas</NavLink>}
      {canTrade && <NavLink to="/mis-subastas">Mis subastas</NavLink>}
      {canTrade && <NavLink to="/posta">Posta pendiente</NavLink>}
    </nav>
  );
}
