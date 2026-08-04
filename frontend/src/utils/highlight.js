// Buscar dentro de un texto ignorando tildes y mayúsculas, devolviendo posiciones que
// siguen sirviendo para cortar el texto ORIGINAL.
//
// Quitar tildes cambia el largo de la cadena cuando el texto viene en forma descompuesta
// —una "ó" guardada como "o" seguida de un acento son dos caracteres que se convierten en
// uno—, así que una posición hallada sobre el texto plegado no se puede usar tal cual: se
// corre una letra por cada acento anterior. Por eso se guarda, para cada letra del texto
// plegado, de qué posición del original salió.

export const strip = (text) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es");

function fold(text) {
  let folded = "";
  const origin = [];
  for (let index = 0; index < text.length; index += 1) {
    for (const character of strip(text[index])) {
      folded += character;
      origin.push(index);
    }
  }
  return { folded, origin };
}

/**
 * Devuelve `{ start, end }` en índices del texto original, o `null` si no coincide.
 */
export function findFolded(text, term) {
  if (!text || !term) return null;
  const needle = strip(term);
  if (!needle) return null;

  const { folded, origin } = fold(text);
  const at = folded.indexOf(needle);
  if (at < 0) return null;

  return { start: origin[at], end: origin[at + needle.length - 1] + 1 };
}
