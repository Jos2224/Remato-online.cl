import { useEffect, useState } from "react";
import { AUCTION_STATES, CATEGORIES, CONDITIONS, SHIPPING } from "../utils/taxonomy";
import { formatMoney } from "../utils/format";

// Una faceta sin resultados se muestra en gris y no se puede marcar, en vez de
// desaparecer: si las opciones bailan al marcar una casilla, nadie encuentra dos veces
// seguidas el mismo filtro.
function FacetGroup({ title, options, selected, counts, onToggle }) {
  return (
    <section className="facet">
      <h3 className="facet__title">{title}</h3>
      <ul className="facet__list">
        {options.map(({ value, label }) => {
          const count = counts?.[value] ?? 0;
          const checked = selected.includes(value);
          return (
            <li key={value}>
              <label className={`facet__option${count === 0 && !checked ? " is-empty" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={count === 0 && !checked}
                  onChange={() => onToggle(value)}
                />
                <span className="facet__label">{label}</span>
                <span className="facet__count">{count}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// El rango de precio no se aplica al teclear: se confirma. Filtrar en cada pulsación
// dispara una consulta por dígito y deja la lista vacía mientras se escribe "150000".
function PriceFacet({ min, max, onApply }) {
  const [draftMin, setDraftMin] = useState(min ?? "");
  const [draftMax, setDraftMax] = useState(max ?? "");

  useEffect(() => setDraftMin(min ?? ""), [min]);
  useEffect(() => setDraftMax(max ?? ""), [max]);

  const clean = (value) => {
    const digits = String(value).replace(/\D/g, "");
    return digits ? Number(digits) : null;
  };

  return (
    <section className="facet">
      <h3 className="facet__title">Precio</h3>
      <form
        className="facet__price"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(clean(draftMin), clean(draftMax));
        }}
      >
        <label>
          <span className="sr-only">Precio mínimo</span>
          <input inputMode="numeric" placeholder="Mín." value={draftMin} onChange={(event) => setDraftMin(event.target.value)} />
        </label>
        <span aria-hidden="true">–</span>
        <label>
          <span className="sr-only">Precio máximo</span>
          <input inputMode="numeric" placeholder="Máx." value={draftMax} onChange={(event) => setDraftMax(event.target.value)} />
        </label>
        <button className="button button--ghost button--small" type="submit">Aplicar</button>
      </form>
      {(min != null || max != null) && (
        <p className="facet__price-summary">
          {min != null && max != null
            ? `Entre ${formatMoney(min)} y ${formatMoney(max)}`
            : min != null
              ? `Desde ${formatMoney(min)}`
              : `Hasta ${formatMoney(max)}`}
        </p>
      )}
    </section>
  );
}

export function BrowseFilters({ facets, filters, onToggle, onPrice, onClear, activeCount }) {
  // En un teléfono la barra lateral ocuparía una pantalla entera antes del primer
  // producto, así que ahí va plegada. En escritorio el botón no se muestra y las facetas
  // están siempre a la vista: `is-open` sólo manda por debajo del punto de quiebre.
  const [open, setOpen] = useState(false);

  return (
    <aside className={`browse-filters${open ? " is-open" : ""}`} aria-label="Filtros">
      <button
        type="button"
        className="browse-filters__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Filtrar{activeCount > 0 ? ` (${activeCount})` : ""}
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      <div className="browse-filters__head">
        <h2>Filtrar</h2>
        {activeCount > 0 && (
          <button type="button" className="browse-filters__clear" onClick={onClear}>
            Limpiar ({activeCount})
          </button>
        )}
      </div>

      <div className="browse-filters__body">
        <FacetGroup
          title="Estado de la subasta"
          options={AUCTION_STATES}
          counts={facets.status}
          selected={filters.status}
          onToggle={(value) => onToggle("status", value)}
        />
        <FacetGroup
          title="Categoría"
          options={CATEGORIES.map((value) => ({ value, label: value }))}
          counts={facets.category}
          selected={filters.category}
          onToggle={(value) => onToggle("category", value)}
        />
        <FacetGroup
          title="Estado del producto"
          options={CONDITIONS.map((value) => ({ value, label: value }))}
          counts={facets.condition}
          selected={filters.condition}
          onToggle={(value) => onToggle("condition", value)}
        />
        <FacetGroup
          title="Entrega"
          options={SHIPPING}
          counts={facets.shipping}
          selected={filters.shippingMethod}
          onToggle={(value) => onToggle("shippingMethod", value)}
        />
        <PriceFacet min={filters.priceMin} max={filters.priceMax} onApply={onPrice} />
      </div>
    </aside>
  );
}
