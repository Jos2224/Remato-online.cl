// Closed vocabularies. The frontend already renders these as <select> inputs; the API
// has to enforce the same lists or a typo (or a crafted request) silently creates a new
// category and fragments the catalogue filter.
export const CATEGORIES = Object.freeze([
  'Tecnología',
  'Vehículos',
  'Hogar',
  'Herramientas',
  'Deportes',
  'Moda',
  'Coleccionables',
  'Industrial',
  'Otros',
]);

export const CONDITIONS = Object.freeze([
  'Nuevo',
  'Como nuevo',
  'Usado',
  'Para reparar',
]);
