// Vocabularios cerrados, en un solo sitio.
//
// Estas listas ya existían escritas a mano dentro del formulario de publicación. Con la
// barra lateral de filtros habría una segunda copia, y dos copias de una lista cerrada se
// separan sin que nadie se dé cuenta: se publica en una categoría que el filtro no
// ofrece. La fuente de verdad sigue siendo `backend/src/domain/taxonomy.js`, que es quien
// la valida; esto es su reflejo para la interfaz.

export const CATEGORIES = Object.freeze([
  "Tecnología",
  "Vehículos",
  "Hogar",
  "Herramientas",
  "Deportes",
  "Moda",
  "Coleccionables",
  "Industrial",
  "Otros",
]);

export const CONDITIONS = Object.freeze(["Nuevo", "Como nuevo", "Usado", "Para reparar"]);

export const SHIPPING = Object.freeze([
  { value: "PICKUP", label: "Retiro en persona" },
  { value: "CHILEXPRESS", label: "Envío por Chilexpress" },
]);

// Cómo se llama cada estado de una subasta de cara a quien mira. El valor en mayúsculas es
// el que viaja a la API; el de abajo, el que se lee.
export const AUCTION_STATES = Object.freeze([
  { value: "ACTIVE", label: "Aceptando ofertas" },
  { value: "MATCHING", label: "En posta" },
  { value: "SOLD", label: "Vendidas" },
  { value: "NO_MATCH", label: "Terminadas sin comprador" },
]);
