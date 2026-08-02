import { Link, useParams } from "react-router-dom";
import { legalApi } from "../api/client";
import { ErrorState, PageLoader } from "../components/States";
import { usePollingQuery } from "../hooks/usePollingQuery";

// Render mínimo del documento. El cuerpo se escribe en un subconjunto de Markdown
// (encabezados, listas, negritas) y se convierte a elementos de React: nunca se inyecta
// HTML crudo, de modo que el texto legal no puede introducir marcado ejecutable.
function renderBody(body) {
  const blocks = [];
  let list = null;

  const flush = () => {
    if (list) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {list.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>,
      );
      list = null;
    }
  };

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (bullet) {
      list = list ?? [];
      list.push(bullet[1]);
      continue;
    }
    flush();
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const Tag = `h${heading[1].length}`;
      blocks.push(<Tag key={blocks.length}>{inline(heading[2])}</Tag>);
      continue;
    }
    blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return blocks;
}

// Sólo **negrita**; cualquier otra cosa queda como texto plano.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

export function LegalIndexPage() {
  const { data: documents, loading, error, reload } = usePollingQuery(() => legalApi.list(), {
    interval: 0,
  });

  if (loading) return <PageLoader label="Cargando documentos legales" />;
  if (error) {
    return (
      <div className="container page-space">
        <ErrorState title="No pudimos cargar los documentos" error={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="container page-space legal-index">
      <span className="eyebrow">Legal</span>
      <h1>Documentos legales</h1>
      <p className="legal-index__intro">
        Estas son las condiciones bajo las que opera RematoOnline. Se firman
        electrónicamente al publicar o al pujar, que es cuando asumes obligaciones
        reales; crear una cuenta no exige aceptar nada. Puedes leerlas aquí en cualquier
        momento, sin necesidad de tener cuenta.
      </p>
      <ul className="legal-index__list">
        {documents.map((item) => (
          <li key={item.slug}>
            <Link to={`/legal/${item.slug}`}>
              <strong>{item.title}</strong>
              <span>{item.summary}</span>
              <small>Versión {item.version}</small>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LegalDocumentPage() {
  const { slug } = useParams();
  // Ojo: no llamar `document` a esta variable; taparía el `document` del navegador.
  const { data: legalDocument, loading, error, reload } = usePollingQuery(
    () => legalApi.get(slug),
    { interval: 0, deps: [slug] },
  );

  if (loading) return <PageLoader label="Cargando documento" />;
  if (error || !legalDocument) {
    return (
      <div className="container page-space">
        <ErrorState title="No encontramos ese documento" error={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="container page-space legal-document">
      <nav className="breadcrumbs" aria-label="Migas de pan">
        <Link to="/">Inicio</Link>
        <span>/</span>
        <Link to="/legal">Legal</Link>
        <span>/</span>
        <span>{legalDocument.title}</span>
      </nav>

      <article className="legal-document__body">{renderBody(legalDocument.body)}</article>

      <footer className="legal-document__meta">
        <p>
          Versión {legalDocument.version} · Huella SHA-256 del texto:{" "}
          <code>{legalDocument.contentHash}</code>
        </p>
        <p>
          Esta huella identifica el texto exacto. Cuando aceptas un documento, queda
          registrada junto a tu firma, de modo que siempre es posible acreditar qué
          versión firmaste.
        </p>
      </footer>
    </div>
  );
}
