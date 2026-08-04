import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auctionsApi } from "../api/client";
import { findFolded } from "../utils/highlight";

// Lo que se teclea no se consulta letra por letra: se espera a que la persona deje de
// escribir. 180 ms es el punto donde la lista ya se siente instantánea y el servidor deja
// de recibir una consulta por pulsación.
const DEBOUNCE_MS = 180;
// Con una sola letra todo coincide con todo; el desplegable sería ruido.
const MIN_LENGTH = 2;

function useDebounced(value, delay) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

// Resalta el trozo que coincide con lo tecleado. La comparación ignora tildes y
// mayúsculas —"camion" ilumina "Camión"— pero lo que se muestra es siempre el texto tal
// como está escrito; `findFolded` traduce la coincidencia a posiciones del original.
function Highlighted({ text, term }) {
  const match = findFolded(text, term);
  if (!match) return text;
  return (
    <>
      {text.slice(0, match.start)}
      <mark>{text.slice(match.start, match.end)}</mark>
      {text.slice(match.end)}
    </>
  );
}

export function SearchBar({ value, onSearch, onPickCategory, placeholder = "Buscar en RematoOnline" }) {
  const navigate = useNavigate();
  const listId = useId();
  const [draft, setDraft] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState([]);
  // De qué palabra son las sugerencias que hay guardadas. Sin esto, las de una búsqueda
  // anterior seguían en memoria y volvían a aparecer al hacer clic en la caja, aunque
  // estuviera vacía: un panel blanco colgando debajo sin relación con nada.
  const [suggestedFor, setSuggestedFor] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef(null);
  const settled = useDebounced(draft, DEBOUNCE_MS);

  // Si el término cambia desde fuera (al abrir un enlace compartido, o al pulsar atrás),
  // la caja tiene que reflejarlo.
  useEffect(() => setDraft(value ?? ""), [value]);

  useEffect(() => {
    const term = settled.trim();
    if (term.length < MIN_LENGTH) {
      setSuggestions([]);
      setSuggestedFor("");
      return undefined;
    }
    // Una respuesta lenta de una consulta vieja no puede pisar a la de la palabra actual.
    const controller = new AbortController();
    let current = true;
    auctionsApi.suggest(term, { signal: controller.signal }).then((results) => {
      if (current) {
        setSuggestions(results);
        setSuggestedFor(term);
        setHighlighted(-1);
      }
    });
    return () => {
      current = false;
      controller.abort();
    };
  }, [settled]);

  // Un clic fuera cierra el desplegable; si no, queda flotando sobre la página.
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // El desplegable sólo existe si hay algo escrito Y las sugerencias guardadas son de eso
  // que está escrito ahora mismo. Con una caja vacía nunca aparece nada.
  const visible = open && suggestions.length > 0 && suggestedFor === draft.trim();

  const commit = (term) => {
    setOpen(false);
    setSuggestions([]);
    setSuggestedFor("");
    setHighlighted(-1);
    onSearch(term.trim());
  };

  const choose = (suggestion) => {
    setOpen(false);
    if (suggestion.kind === "category") {
      setDraft("");
      onPickCategory?.(suggestion.value);
      return;
    }
    setDraft(suggestion.label);
    navigate(`/subastas/${suggestion.value}`);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (visible && highlighted >= 0) choose(suggestions[highlighted]);
      else commit(draft);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!visible) {
      setOpen(true);
      return;
    }
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    // Da la vuelta en ambos extremos, y -1 significa "ninguna, lo que escribí yo".
    setHighlighted((index) => {
      const next = index + step;
      if (next < -1) return suggestions.length - 1;
      if (next >= suggestions.length) return -1;
      return next;
    });
  };

  return (
    <div className="smart-search" ref={containerRef}>
      <form
        className="smart-search__field"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          commit(draft);
        }}
      >
        <span className="smart-search__icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          value={draft}
          placeholder={placeholder}
          aria-label="Buscar subastas"
          // El navegador guarda lo que se ha enviado antes en este campo y lo ofrece en su
          // propio panel blanco al hacer clic. Se parece a nuestro desplegable, no lo
          // controlamos y sale igual con la caja vacía: se apaga.
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={visible}
          aria-controls={listId}
          aria-activedescendant={highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
          }}
          // Hacer clic en una caja vacía no despliega nada: no hay qué sugerir.
          onFocus={() => setOpen(draft.trim().length >= MIN_LENGTH)}
          onKeyDown={onKeyDown}
        />
        {draft && (
          <button
            type="button"
            className="smart-search__clear"
            aria-label="Borrar la búsqueda"
            onClick={() => {
              setDraft("");
              commit("");
            }}
          >
            ×
          </button>
        )}
        <button className="smart-search__submit" type="submit">Buscar</button>
      </form>

      {visible && (
        <ul className="smart-search__suggestions" id={listId} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.kind}-${suggestion.value}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlighted}
              className={`smart-search__suggestion${index === highlighted ? " is-highlighted" : ""}`}
              // `mousedown` y no `click`: el clic llega después de que el input pierda el
              // foco, y para entonces el desplegable ya se cerró bajo el cursor.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(suggestion);
              }}
              onMouseEnter={() => setHighlighted(index)}
            >
              <span className="smart-search__suggestion-label">
                <Highlighted text={suggestion.label} term={draft.trim()} />
              </span>
              {suggestion.kind === "category" ? (
                <span className="smart-search__suggestion-meta">
                  en categoría · {suggestion.count}
                </span>
              ) : (
                <span className="smart-search__suggestion-meta">subasta</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
