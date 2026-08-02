import { createHash } from 'node:crypto';

// Documentos legales de la plataforma.
//
// Se definen en código, no en la base de datos, por dos razones: quedan versionados en
// el repositorio junto al resto del producto, y el texto exacto que una persona aceptó
// se puede reconstruir siempre a partir de su hash, aunque el documento cambie después.
//
// REGLA: nunca editar el texto de una versión ya publicada. Un cambio de fondo exige
// subir `version`; las aceptaciones antiguas siguen apuntando a la versión anterior y el
// sistema vuelve a pedir la firma.

const HEADER = 'RematoOnline · Documento legal';

export const ACCEPTANCE_CONTEXTS = Object.freeze({
  REGISTRATION: 'REGISTRATION',
  PUBLISH: 'PUBLISH',
  BID: 'BID',
});

const documents = [
  {
    slug: 'terminos-y-condiciones',
    version: '1.0',
    title: 'Términos y Condiciones de Uso',
    summary:
      'Reglas generales del servicio, rol de la plataforma, comisiones y responsabilidades.',
    requiredFor: [ACCEPTANCE_CONTEXTS.REGISTRATION],
    body: `${HEADER}

# Términos y Condiciones de Uso

**Versión 1.0**

## 1. Quiénes somos y qué hacemos

RematoOnline es una plataforma que permite a personas usuarias publicar bienes y
ofertar por ellos mediante un mecanismo de subasta. La plataforma actúa como
**intermediaria**: no es dueña de los bienes publicados, no los posee, no los examina
y no participa como parte del contrato de compraventa que se celebra entre la persona
vendedora y la persona compradora.

La relación entre RematoOnline y quien usa la plataforma es una relación de prestación
de un servicio de intermediación digital. La compraventa del bien es un contrato
separado, celebrado entre dos personas usuarias.

## 2. Capacidad y registro

Para usar la plataforma debes ser mayor de 18 años y tener capacidad legal para
contratar conforme al Código Civil. Al registrarte declaras que la información que
entregas es veraz y que la mantendrás actualizada. Una cuenta es personal e
intransferible; respondes por todo lo que ocurra bajo tus credenciales.

Podemos suspender o cerrar una cuenta cuando exista incumplimiento de estos términos,
uso fraudulento, o cuando una autoridad competente lo ordene.

## 3. Naturaleza de la oferta y formación del contrato

Cada puja constituye una **oferta seria, firme e irrevocable** en los términos de los
artículos 97 y siguientes del Código de Comercio, sujeta a las reglas de adjudicación
descritas en las Reglas de Compra.

El contrato de compraventa se perfecciona cuando la persona adjudicataria acepta la
adjudicación dentro del plazo del turno. La plataforma deja registro del momento exacto
de esa aceptación.

## 4. Comisiones

RematoOnline cobra una comisión de **5% sobre el precio de adjudicación**, que se
descuenta del monto que recibe la persona vendedora al concretarse la venta. Esta
comisión remunera el servicio de intermediación.

Cualquier modificación de la comisión se informará con al menos 30 días de anticipación
y no afectará subastas ya publicadas.

## 5. Garantía de seriedad y cláusula penal

Al pujar se congela una **garantía equivalente al 10% del monto ofertado**. Si la
persona adjudicataria rechaza la adjudicación o deja vencer su turno sin responder,
pierde esa garantía. Esta pérdida constituye una **cláusula penal** en los términos de
los artículos 1535 y siguientes del Código Civil, avaluando anticipadamente el perjuicio
causado por la no concreción de la venta.

La garantía perdida se distribuye: **70% a la persona vendedora** afectada y **30% a la
plataforma** por costos de la adjudicación fallida. Las Reglas de Compra detallan este
mecanismo y deben aceptarse expresamente antes de pujar.

## 6. Qué no hacemos

La plataforma **no garantiza**: la existencia, calidad, estado, autenticidad, legalidad
ni aptitud para un fin determinado de los bienes publicados; ni la veracidad de las
descripciones; ni que una venta llegue a concretarse.

La entrega del bien y la verificación de su estado son responsabilidad exclusiva de las
partes. Recomendamos coordinar la entrega en un lugar seguro y revisar el bien antes de
darlo por recibido.

## 7. Bienes prohibidos

No pueden publicarse bienes cuyo comercio esté prohibido o restringido por la
legislación chilena, incluyendo entre otros: armas y municiones sujetas a control
(Ley 17.798), drogas y sustancias sujetas a la Ley 20.000, medicamentos, especies
protegidas, bienes robados o de origen ilícito, documentos de identidad, y cualquier
bien cuya transferencia requiera autorización especial que no se posea.

Publicar un bien prohibido faculta a la plataforma para retirar la publicación de
inmediato y cerrar la cuenta, sin perjuicio de las denuncias que correspondan.

## 8. Obligaciones tributarias

Cada persona usuaria es responsable de sus propias obligaciones tributarias. Quien
venda de forma habitual puede estar obligada a emitir boleta o factura y a declarar
ante el Servicio de Impuestos Internos. RematoOnline no emite documentos tributarios
por la compraventa entre usuarias y usuarios; sólo por su propia comisión, cuando
corresponda.

## 9. Ley del consumidor

La Ley 19.496 sobre Protección de los Derechos de los Consumidores rige las relaciones
entre proveedores y consumidores. Respecto del **servicio de intermediación** que
presta RematoOnline, esa ley resulta aplicable y se respetan los derechos que consagra.

Respecto de la **compraventa entre dos personas naturales** que no actúan como
proveedoras, la relación se rige por las normas generales del Código Civil. Si quien
vende lo hace de manera habitual y profesional, puede ser considerada proveedora y
quedar sujeta a la Ley 19.496 frente a quien compra.

## 10. Datos personales

El tratamiento de datos personales se rige por nuestra Política de Privacidad, conforme
a la Ley 19.628 y a la Ley 21.719 sobre protección de datos personales.

## 11. Modificaciones

Podemos actualizar estos términos. Los cambios de fondo generan una nueva versión y se
solicitará tu aceptación antes de que puedas seguir publicando u ofertando. Las
subastas en curso se rigen por la versión vigente al momento de publicarse.

## 12. Ley aplicable y jurisdicción

Estos términos se rigen por la ley chilena. Cualquier controversia se someterá a los
tribunales ordinarios de justicia con competencia en Chile, sin perjuicio del derecho
de las personas consumidoras a recurrir al SERNAC o a los Juzgados de Policía Local
conforme a la Ley 19.496.`,
  },

  {
    slug: 'politica-de-privacidad',
    version: '1.0',
    title: 'Política de Privacidad',
    summary:
      'Qué datos tratamos, con qué finalidad, por cuánto tiempo y cómo ejercer tus derechos.',
    requiredFor: [ACCEPTANCE_CONTEXTS.REGISTRATION],
    body: `${HEADER}

# Política de Privacidad

**Versión 1.0**

## 1. Responsable del tratamiento

RematoOnline es responsable del tratamiento de los datos personales que se recogen a
través de la plataforma, conforme a la Ley 19.628 sobre Protección de la Vida Privada y
a la Ley 21.719 sobre protección de datos personales.

## 2. Qué datos tratamos

- **De registro:** correo electrónico y contraseña (almacenada siempre cifrada mediante
  una función de hash; nadie en la plataforma puede leerla).
- **De actividad:** publicaciones, pujas, adjudicaciones y movimientos de saldo.
- **De aceptación legal:** fecha, hora, dirección IP, agente de usuario y versión exacta
  del documento aceptado. Estos datos son necesarios para acreditar el consentimiento.
- **Técnicos:** registros de acceso necesarios para la seguridad del servicio.

No solicitamos datos sensibles en el sentido del artículo 2 letra g) de la Ley 19.628.

## 3. Para qué los usamos

- Operar el mecanismo de subasta y la adjudicación.
- Acreditar la aceptación de los documentos legales.
- Prevenir fraude y usos abusivos.
- Cumplir obligaciones legales y requerimientos de autoridad competente.

No vendemos ni cedemos datos personales a terceros con fines comerciales.

## 4. Qué ve el resto de las personas usuarias

Tu dirección de correo **no es pública**. En las publicaciones y en el historial de
pujas se muestra un **alias** derivado de tu identificador de cuenta.

El correo se comparte únicamente entre las dos partes de una venta ya concretada, y
sólo en la medida necesaria para coordinar la entrega. La administración de la
plataforma puede acceder a él para resolver disputas o cumplir obligaciones legales.

## 5. Por cuánto tiempo

Los datos de cuenta se conservan mientras la cuenta esté activa. Los registros de
transacciones y de aceptación legal se conservan por el plazo necesario para acreditar
las operaciones y cumplir obligaciones legales, incluso después del cierre de la cuenta.

El libro de movimientos de saldo es **inmutable por diseño**: no se modifica ni se
elimina, porque constituye el respaldo contable de cada operación.

## 6. Tus derechos

Puedes ejercer los derechos de **acceso, rectificación, cancelación y oposición**, y los
demás que reconoce la Ley 21.719, escribiendo a la administración de la plataforma.
Responderemos en los plazos legales.

La eliminación de datos puede estar limitada cuando exista una obligación legal de
conservarlos o cuando sean necesarios para acreditar operaciones ya realizadas.

## 7. Seguridad

Aplicamos medidas técnicas y organizativas razonables: contraseñas cifradas, transporte
cifrado, control de acceso y límites de tasa frente a intentos automatizados. Ningún
sistema es invulnerable; ante un incidente que afecte tus datos, informaremos conforme
a la ley.

## 8. Cambios

Los cambios de fondo en esta política generan una nueva versión y se solicitará tu
aceptación.`,
  },

  {
    slug: 'reglas-de-venta',
    version: '1.0',
    title: 'Reglas de Venta',
    summary:
      'Declaraciones y obligaciones que asumes al publicar un bien en subasta.',
    requiredFor: [ACCEPTANCE_CONTEXTS.PUBLISH],
    body: `${HEADER}

# Reglas de Venta

**Versión 1.0**

Al publicar una subasta declaras y aceptas lo siguiente.

## 1. Declaraciones sobre el bien

1. Eres **dueña o dueño** del bien, o cuentas con facultad suficiente para venderlo.
2. El bien **no proviene de un delito** ni está sujeto a prenda, embargo, medida
   precautoria u otra limitación que impida transferirlo.
3. La descripción es **veraz y completa**. Declaras los defectos relevantes que conoces.
   Omitir un defecto conocido puede constituir dolo conforme al artículo 1458 del Código
   Civil y te hace responsable frente a quien compra.
4. Las fotografías corresponden al bien real que ofreces, no a imágenes de catálogo de
   un bien distinto.
5. El bien no se encuentra entre los prohibidos por los Términos y Condiciones.

## 2. La publicación obliga

La publicación de una subasta constituye una **oferta de venta seria**. Si la subasta
recibe pujas y se adjudica, quedas obligada u obligado a celebrar la compraventa y a
entregar el bien en el estado descrito.

## 3. Cierre y edición

1. Puedes editar la publicación mientras no existan pujas activas.
2. **Una vez que ingresa la primera puja, la fecha de cierre queda fija.** No se puede
   adelantar ni postergar: adelantarla perjudica a quien ya ofertó, y postergarla
   mantiene su dinero congelado más tiempo del comprometido.
3. Toda puja recibida en los **últimos 2 minutos** prorroga el cierre por 2 minutos
   adicionales, para que ninguna oferta gane sólo por llegar sobre la hora.

## 4. Adjudicación

Al cerrar la subasta se abre un turno para la mejor oferta. Si esa persona rechaza o
deja vencer su turno, el turno pasa a la oferta siguiente, y así sucesivamente.

Cuando alguien acepta, la venta queda registrada y recibes el **95% del precio de
adjudicación**; el 5% restante corresponde a la comisión de la plataforma.

Si ninguna persona acepta, la subasta termina sin comprador. Recibes el **70% de la
garantía perdida** por cada persona que rechazó o dejó vencer su turno, como
compensación por la venta no concretada.

## 5. Entrega

La entrega se coordina **directamente entre las partes**. La plataforma no transporta,
no almacena, no verifica ni interviene en la entrega. Debes entregar el bien en el
estado y plazo acordados.

## 6. Responsabilidad

Respondes frente a quien compra por la evicción y por los vicios redhibitorios conforme
a los artículos 1837 y siguientes del Código Civil. Si vendes de forma habitual y
profesional, puedes ser considerada proveedora conforme a la Ley 19.496 y quedar sujeta
a las obligaciones de garantía legal que esa ley establece.

## 7. Tributos

Eres responsable de tus obligaciones tributarias derivadas de la venta.`,
  },

  {
    slug: 'reglas-de-compra',
    version: '1.0',
    title: 'Reglas de Compra y Puja',
    summary:
      'Qué significa pujar, cómo funciona la garantía del 10% y qué pasa si no cumples.',
    requiredFor: [ACCEPTANCE_CONTEXTS.BID],
    body: `${HEADER}

# Reglas de Compra y Puja

**Versión 1.0**

Lee esto con atención: **pujar compromete tu dinero.**

## 1. Una puja es una oferta irrevocable

Al pujar formulas una **oferta seria, firme e irrevocable** de comprar el bien al precio
ofertado. No es una manifestación de interés ni una consulta.

Puedes retirar tu puja **sólo mientras la subasta siga abierta**. Una vez cerrada, tu
oferta queda comprometida hasta que la subasta se resuelva.

## 2. Garantía del 10%

Al pujar se **congela el 10% del monto ofertado** de tu saldo disponible. Ese dinero
sigue siendo tuyo, pero queda inmovilizado como garantía de seriedad mientras tu puja
esté vigente.

No se congela el monto completo: así puedes participar en varias subastas a la vez.

La garantía se **libera íntegramente** cuando: retiras la puja antes del cierre, otra
persona se adjudica la subasta, o la subasta termina sin adjudicación para ti.

## 3. Incremento mínimo

Cada nueva puja debe superar la anterior por un incremento mínimo según el tramo de
precio: $500 bajo $10.000; $1.000 bajo $50.000; $2.000 bajo $200.000; $5.000 bajo
$1.000.000; y $10.000 desde ese monto.

## 4. El turno de adjudicación

Al cerrar la subasta, la mejor oferta recibe un **turno para aceptar o rechazar** la
adjudicación. El turno tiene un plazo determinado, informado en pantalla, contado desde
que el turno efectivamente se abre.

- **Si aceptas:** se perfecciona la compraventa. Se cobra el 90% restante del precio
  desde tu saldo disponible, además de la garantía ya congelada. **Debes tener saldo
  suficiente**: si no lo tienes, no podrás aceptar y podrías perder la adjudicación.
- **Si rechazas o dejas vencer el plazo:** pierdes la garantía del 10%.

## 5. Cláusula penal: qué pierdes exactamente

La pérdida de la garantía es una **cláusula penal** conforme a los artículos 1535 y
siguientes del Código Civil. Al aceptar este documento reconoces que el monto es una
avaluación anticipada y razonable del perjuicio que causa una adjudicación no
concretada, y renuncias a discutir su procedencia por el solo hecho del incumplimiento.

La garantía perdida se distribuye así:

- **70% a la persona vendedora**, que perdió la venta y debe reiniciar el proceso.
- **30% a la plataforma**, por los costos de la adjudicación fallida.

**Ejemplo.** Ofertas $90.000. Se congelan $9.000. Si te adjudicas y aceptas, pagas los
$81.000 restantes y recibes el bien. Si rechazas o dejas vencer el turno, pierdes los
$9.000: $6.300 van a quien vendía y $2.700 a la plataforma.

## 6. Entrega y verificación

La entrega se coordina **directamente con la persona vendedora**. Revisa el bien al
recibirlo. La plataforma no interviene en la entrega ni actúa como depositaria del
bien.

## 7. Si el bien no corresponde

Si el bien no corresponde a lo descrito, tienes las acciones que el Código Civil
concede al comprador, en particular las acciones por vicios redhibitorios de los
artículos 1857 y siguientes. Si quien vende actúa de manera habitual y profesional,
pueden además aplicarse los derechos de la Ley 19.496.

Informa el problema a la administración de la plataforma: podemos aportar los registros
de la operación, aunque no somos parte del contrato de compraventa.

## 8. Saldo

El saldo de la plataforma refleja los montos asociados a tus operaciones. Cada
movimiento queda registrado en un libro **inmutable**, que puedes consultar en
cualquier momento desde tu cuenta.`,
  },
];

// El hash identifica el texto exacto. Una aceptación guarda slug + versión + hash, de
// modo que siempre se puede demostrar qué se firmó, aunque el documento evolucione.
export const LEGAL_DOCUMENTS = Object.freeze(
  documents.map((document) =>
    Object.freeze({
      ...document,
      requiredFor: Object.freeze([...document.requiredFor]),
      contentHash: createHash('sha256').update(document.body, 'utf8').digest('hex'),
    }),
  ),
);

export const findDocument = (slug) =>
  LEGAL_DOCUMENTS.find((document) => document.slug === slug) ?? null;

export const documentsRequiredFor = (context) =>
  LEGAL_DOCUMENTS.filter((document) => document.requiredFor.includes(context));
