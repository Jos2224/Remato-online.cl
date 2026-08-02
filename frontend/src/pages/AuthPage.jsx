import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { InlineNotice, Spinner } from "../components/States";
import { describeApiError } from "../utils/format";

export function AuthPage({ mode }) {
  const registering = mode === "register";
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/cuenta" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || password.length < 8) {
      setError("Ingresa un correo válido y una contraseña de al menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      const credentials = { email: email.trim().toLowerCase(), password };
      await (registering ? register(credentials) : login(credentials));
      const destination = location.state?.from?.pathname || "/cuenta";
      navigate(destination, { replace: true });
    } catch (nextError) {
      setError(describeApiError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-page__panel">
        <Link className="brand" to="/">
          <span className="brand__mark">R</span>
          <span>Remato<span>Online</span></span>
        </Link>
        <span className="eyebrow">{registering ? "Cuenta nueva" : "Bienvenido de vuelta"}</span>
        <h1>{registering ? "Crea tu cuenta" : "Entra a tu cuenta"}</h1>
        <p>{registering ? "Solo necesitas correo y contraseña. Podrás comprar y vender desde la misma cuenta." : "Revisa tus pujas, saldos y subastas en un solo lugar."}</p>

        <form className="auth-form" onSubmit={submit} noValidate>
          {error && <InlineNotice type="error">{error}</InlineNotice>}
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.cl" required />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" minLength="8" autoComplete={registering ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" required />
          </div>
          <button className="button button--red button--large button--full" type="submit" disabled={submitting}>
            {submitting && <Spinner small />}
            {registering ? "Crear cuenta" : "Ingresar"}
          </button>
        </form>

        <p className="auth-page__switch">
          {registering ? "¿Ya tienes cuenta?" : "¿Primera vez acá?"}{" "}
          <Link to={registering ? "/ingresar" : "/registro"}>{registering ? "Ingresa" : "Regístrate"}</Link>
        </p>
      </div>
      <aside className="auth-page__aside">
        <span className="auth-page__big-mark">R</span>
        <blockquote>“Cada oferta es visible. Cada peso comprometido queda registrado.”</blockquote>
        <p>Una plataforma pequeña por diseño, preparada para crecer.</p>
      </aside>
    </section>
  );
}
