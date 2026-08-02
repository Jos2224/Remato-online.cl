import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { systemApi } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { setServerInstant } from "../utils/server-clock";
import { ToastProvider } from "./Toast";

function Header() {
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const canTrade = isAuthenticated && user?.role === "user";
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="container header__inner">
        <Link className="brand" to="/" onClick={close} aria-label="RematoOnline, inicio">
          <span className="brand__mark" aria-hidden="true">R</span>
          <span>Remato<span>Online</span></span>
        </Link>

        <button
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="sr-only">Abrir navegación</span>
          <span /><span /><span />
        </button>

        <nav id="main-navigation" className={`header__nav${open ? " header__nav--open" : ""}`} aria-label="Navegación principal">
          <NavLink to="/" onClick={close}>Subastas</NavLink>
          {canTrade && <NavLink to="/mis-pujas" onClick={close}>Mis pujas</NavLink>}
          {canTrade && <NavLink to="/mis-subastas" onClick={close}>Mis subastas</NavLink>}
          {canTrade && <NavLink to="/posta" onClick={close}>Posta</NavLink>}
          {isAuthenticated ? (
            <>
              <NavLink className="header__account" to="/cuenta" onClick={close}>
                <span className="avatar">{user?.email?.[0]?.toUpperCase() || "U"}</span>
                <span>{user?.email}</span>
              </NavLink>
              <button className="button button--ghost button--small" type="button" onClick={() => { logout(); close(); }}>
                Salir
              </button>
            </>
          ) : (
            <NavLink className="button button--ghost button--small" to="/ingresar" onClick={close}>Ingresar</NavLink>
          )}
          {(!isAuthenticated || canTrade) && (
            <NavLink className="button button--red button--small" to={isAuthenticated ? "/publicar" : "/ingresar"} onClick={close}>
              Publicar
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer__inner">
        <div>
          <Link className="brand brand--footer" to="/">
            <span className="brand__mark">R</span>
            <span>Remato<span>Online</span></span>
          </Link>
          <p>Subastas transparentes entre personas.</p>
        </div>
        <div className="footer__rules">
          <p><strong>Hora oficial:</strong> America/Santiago</p>
          <p><strong>Match:</strong> 5% de comisión</p>
          <p><strong>Rechazo:</strong> 10% de penalización</p>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  useEffect(() => {
    const synchronize = async () => {
      const startedAt = Date.now();
      try {
        const health = await systemApi.health();
        setServerInstant(health.utcNow, startedAt, Date.now());
      } catch {
        // The API remains authoritative even if this optional visual sync fails.
      }
    };

    synchronize();
    const timer = window.setInterval(synchronize, 5 * 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <ToastProvider>
      <div className="app-shell">
        <Header />
        <main id="contenido">
          <Outlet />
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
