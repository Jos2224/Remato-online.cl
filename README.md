# RematoOnline

MVP de subastas abiertas entre particulares. Cualquier visitante puede ver los productos y su historial público de pujas; una cuenta con correo y contraseña puede vender y comprar. El objetivo de esta primera versión es validar el flujo completo con una base sencilla de mantener y fácil de desplegar.

## Qué incluye

- Registro e inicio de sesión solo con correo y contraseña.
- Perfiles públicos con fecha de creación y cantidad de ventas.
- Publicaciones de texto con título, descripción, categoría, estado, precio inicial, comuna, entrega y cierre con hora/minuto de Chile.
- Pujas manuales con incremento mínimo por tramo, historial público y alias en vez de correo.
- Saldo interno de prueba: el usuario puede depositar o retirar confiando en su declaración; cada movimiento queda registrado en el backend.
- Portada de navegación: buscador arriba, facetas al costado y resultados paginados. Por defecto sólo se listan las subastas que aceptan ofertas; las vendidas, las que están en posta y las terminadas sin comprador se piden marcando su casilla en «Estado de la subasta».
- Búsqueda resuelta en PostgreSQL, no en el navegador: encuentra sin tildes («camion» → «Camión»), tolera erratas por trigramas («guitara» → «guitarra»), responde a prefijos mientras se teclea y ordena por relevancia. Cada faceta muestra cuántos resultados tiene, contados sobre todo el catálogo y no sobre la página visible.
- Un único administrador, identificado por `ADMIN_EMAIL`, que recibe comisiones y penalizaciones.

No incluye por ahora fotos, reputación, reclamos, criptomonedas, logística integrada, notificaciones ni moderación.

## Arquitectura

El repositorio separa por completo las dos aplicaciones:

```text
frontend/   SPA pública y portal del usuario
backend/    API Node como monolito modular
PostgreSQL  datos transaccionales y registro de movimientos
```

Es un **monolito modular**, no microservicios. Usuarios, subastas, pujas, billetera y adjudicación viven en un solo backend, separados internamente por dominio. PostgreSQL y sus transacciones protegen los saldos, los fondos congelados y la adjudicación.

### Cierres sin worker

No hay un proceso de fondo. El backend compara siempre los plazos con su reloj y sincroniza los estados al consultar o actuar sobre una subasta; el frontend consulta periódicamente mientras está abierto. Por eso, el cierre es lógicamente exacto aunque el cambio se escriba en la base de datos con la primera petición posterior al plazo.

La misma sincronización avanza los turnos de adjudicación vencidos. Si la plataforma pasa un tiempo sin visitas, la siguiente petición procesa de una vez los pasos pendientes. Todas las fechas se guardan en UTC; la interfaz las captura y muestra en `America/Santiago`, respetando automáticamente los cambios de hora de Chile.

### Buscar y filtrar

`GET /api/auctions` acepta, además de `mine`, `participating`, `sellerId`, `limit` y `offset`:

| Parámetro | Valor | Nota |
| --- | --- | --- |
| `q` | texto, hasta 120 caracteres | Sin tildes, tolerante a erratas y a prefijos. Sin `sort`, ordena por relevancia. |
| `status` | `ACTIVE`, `MATCHING`, `SOLD`, `NO_MATCH` | Lista separada por comas. Omitirlo no filtra por estado; es la portada la que pide `ACTIVE`. |
| `category`, `condition` | vocabulario de `backend/src/domain/taxonomy.js` | Lista separada por comas. |
| `shippingMethod` | `PICKUP`, `CHILEXPRESS` | Lista separada por comas. |
| `priceMin`, `priceMax` | entero en pesos | Se aplican al precio vigente (la puja más alta), no al inicial. |
| `sort` | `closing`, `newest`, `priceAsc`, `priceDesc`, `bids`, `relevance` | Por defecto: relevancia si hay `q`, cierre más próximo si no. |

La respuesta trae `auctions`, `pagination` y `facets`. Los recuentos de cada faceta se calculan con todos los filtros puestos **menos el suyo**, que es lo que permite seguir viendo cuántas subastas vendidas hay mientras se están mirando sólo las activas.

El índice vive en la tabla `auction_search`, aparte de `auctions` y mantenida por un disparador. Está separada a propósito: media aplicación lee una subasta con `SELECT a.*`, y con el `tsvector` en la misma fila cada lectura arrastraría el índice invertido de una descripción de hasta 10.000 caracteres sin que nadie lo use.

## Reglas centrales

1. Una puja exige tener disponible la garantía del 10% del monto ofertado; ese 10% queda congelado.
2. Una puja superior del mismo usuario reemplaza su puja activa y ajusta la reserva. Retirar o reemplazar una puja la quita del historial competitivo público, pero conserva el evento interno para auditoría.
3. El vendedor puede cambiar el cierre, incluso con pujas, siempre que la nueva hora esté al menos tres minutos por delante de la hora actual del servidor. El nuevo cierre aparece en el portal, sin notificación.
4. Al vencer, los postores únicos se ordenan por su puja activa más alta. El primero dispone de una hora para aceptar.
5. Al pujar se congela una garantía del 10% de la oferta (no el monto completo). Si el postor acepta, paga el 90% restante desde su saldo disponible. Si rechaza o vence su turno, pierde la garantía: 70% va al vendedor y 30% cubre costos de plataforma. Luego sigue el próximo postor.
6. Si acepta, se debita su puja: 95% va al vendedor y 5% al administrador. La venta queda concretada y todos los demás recuperan íntegramente sus reservas, salvo quienes ya fueron penalizados.
7. Si se agota la lista, la subasta queda sin match y se liberan íntegramente los fondos de quienes no rechazaron ni dejaron vencer su turno.

Los cambios de saldo deben hacerse dentro de una transacción de base de datos y además generar un asiento de movimientos; nunca se calcula el saldo desde datos enviados por el navegador.

## Ejecutar con Docker

Requiere Docker con Compose.

```bash
cp .env.example .env   # luego RELLENA los secretos vacíos (la app no arranca con valores conocidos)
docker compose up --build
```

En Windows PowerShell, el equivalente del primer comando es:

```powershell
Copy-Item .env.example .env
```

Luego abre `http://localhost:4173`. La API queda en `http://localhost:4000/api` y su estado en `http://localhost:4000/health`. Al iniciar, el contenedor del backend espera a PostgreSQL, aplica las migraciones y crea de forma idempotente la cuenta administradora configurada. Para cargar opcionalmente datos de demostración:

```bash
docker compose exec -e NODE_ENV=development backend npm run seed:demo
```

El segundo comando es solo para desarrollo y nunca se ejecuta automáticamente.

Detener los servicios no borra la base. `docker compose down -v` sí elimina el volumen local y sus datos.

## Ejecutar sin Docker

Requiere Node.js 22+, npm y PostgreSQL 16 (o compatible).

1. Crea una base PostgreSQL y define las variables del backend.
2. Desde la raíz instala ambos workspaces y prepara la base:

```bash
npm install
npm run migrate
npm run seed
npm run dev
```

El frontend de desarrollo usa `http://localhost:5173`; ajusta `CORS_ORIGIN` en consecuencia. Comandos útiles:

```bash
npm run build
npm test
npm run seed:demo
npm run dev:backend
npm run dev:frontend
```

## Variables de entorno

| Variable | Uso | Ejemplo local |
| --- | --- | --- |
| `DATABASE_URL` | Conexión privada del backend a PostgreSQL | `postgresql://rematoonline:...@localhost:5432/rematoonline` |
| `DATABASE_SSL` | Exige TLS hacia PostgreSQL | `false` local, normalmente `true` en producción |
| `JWT_SECRET` | Firma de sesiones; debe ser larga y secreta | ver `.env.example` solo para local |
| `JWT_EXPIRES_IN` | Duración de la sesión | `7d` |
| `ADMIN_EMAIL` | Correo que recibe comisiones/penalizaciones | `admin@rematoonline.cl` |
| `ADMIN_PASSWORD` | Contraseña inicial del administrador | solo secreto del entorno |
| `DEMO_PASSWORD` | Contraseña común del seed de demostración | solo desarrollo |
| `CORS_ORIGIN` | Orígenes web autorizados por la API, separados por coma | `http://localhost:5173,http://localhost:4173` |
| `PORT` / `BACKEND_PORT` | Puerto interno / publicado de la API | `4000` |
| `VITE_API_URL` | URL pública de la API incorporada al build web | `http://localhost:4000/api` |
| `FRONTEND_PORT` | Puerto local del contenedor web | `4173` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Ventana y máximo de solicitudes por IP | `60000` / `120` |

No publiques `.env`. En producción usa los secretos y variables del proveedor.

## Despliegue posterior

- **Frontend:** compila `frontend/` como archivos estáticos y sírvelos desde CDN/Nginx. Define `VITE_API_URL` durante el build con la URL HTTPS pública del backend.
- **Backend:** despliega `backend/` como un único servicio Node, ejecuta las migraciones antes de iniciar y configura `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL` y `CORS_ORIGIN`.
- **Base de datos:** usa PostgreSQL administrado con backups y conexiones TLS. No la expongas directamente a internet.

Frontend y backend pueden escalar o desplegarse por separado. El modelo sin worker basta para este MVP; solo valdría agregar un proceso programado si en el futuro se necesitan notificaciones inmediatas aun cuando nadie esté usando la plataforma.

### Nota de dependencias

React Router está fijado en su versión estable `7.18.2`. Al 1 de agosto de 2026, `npm audit` informa un aviso alto para su modo **RSC/Server Actions** (`GHSA-qwww-vcr4-c8h2`), que no forma parte de esta aplicación: el frontend es una SPA compilada y servida como archivos estáticos por Nginx. Conviene actualizar cuando el proyecto publique una versión estable corregida, sin habilitar RSC mientras tanto.
