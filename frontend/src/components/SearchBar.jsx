import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auctionsApi } from "../api/client";

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

// Resalta el trozo que coincide con lo tecleado, comparando sin tildes y sin mayúsculas
// para que "camion" ilumine "Camión". Se resalta sobre el texto original: lo normalizado
// sirve para encontrar la posición, nunca para mostrarse.
const fold = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

function Highlighted({ text, term }) {
  const start = term ? fold(text).indexOf(fold(term)) : -1;
  if (start < 0) return text;
  return (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, start + term.length)}</mark>
      {text.slice(start + term.length)}
    </>
  );
}

export function SearchBar({ value, onSearch, onPickCategory, placeholder = "Buscar en RematoOnline" }) {
  const navigate = useNavigate();
  const listId = useId();
  const [draft, setDraft] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState([]);
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
      return undefined;
    }
    // Una respuesta lenta de una consulta vieja no puede pisar a la de la palabra actual.
    const controller = new AbortController();
    let current = true;
    auctionsApi.suggest(term, { signal: controller.signal }).then((results) => {
      if (current) {
        setSuggestions(results);
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

  const visible = open && suggestions.length > 0;

  const commit = (term) => {
    setOpen(false);
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
          aria-autocomplete="list"
          aria-expanded={visible}
          aria-controls={listId}
          aria-activedescendant={highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
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
