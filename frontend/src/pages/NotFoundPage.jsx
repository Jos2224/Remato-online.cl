import { Link } from "react-router-dom";
import { EmptyState } from "../components/States";

export function NotFoundPage() {
  return (
    <div className="container page-space">
      <EmptyState eyebrow="Error 404" title="Esta página no existe" description="Puede que el enlace haya cambiado o esté incompleto." action={<Link className="button button--dark" to="/">Volver a las subastas</Link>} />
    </div>
  );
}
