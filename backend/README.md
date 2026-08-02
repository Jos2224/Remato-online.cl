# RematoOnline API

Backend independiente para el MVP de subastas entre particulares. Es un monolito modular: una API Node.js/Express y PostgreSQL. No necesita Redis, cron ni un worker separado.

## Desarrollo local

Requisitos: Node.js 22 y PostgreSQL 15 o superior.

```bash
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run seed:demo   # opcional; está bloqueado en producción
npm run dev
```

La API usa el puerto `4000` por defecto. El healthcheck está en `GET /health` y `GET /api/health`.

El seed normal solo crea o actualiza el administrador configurado con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. El seed demo agrega dos cuentas con la contraseña `DEMO_PASSWORD`, $500.000 CLP simulados para cada una y dos subastas. Nunca se ejecuta automáticamente y se niega a correr con `NODE_ENV=production`.

## Contrato HTTP

Las respuestas exitosas tienen la forma `{ "data": ... }`. Los errores usan `{ "error": { "code", "message", "details"? } }`. Todos los montos son enteros CLP.

| Método | Ruta | Autenticación | Uso |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Crear cuenta con `email`, `password` |
| POST | `/api/auth/login` | No | Obtener JWT |
| GET | `/api/auth/me` | Sí | Cuenta y billetera propias |
| GET | `/api/users/:id` | No | Perfil público |
| GET | `/api/wallet` | Sí | Saldos disponible y congelado |
| POST | `/api/wallet/deposit` | Sí | Abono simulado `{ amount }` |
| POST | `/api/wallet/withdraw` | Sí | Retiro simulado `{ amount }` |
| GET | `/api/wallet/entries` | Sí | Libro contable propio |
| GET | `/api/auctions` | Opcional | Lista pública; filtros `status`, `sellerId`, `mine`, `participating` |
| POST | `/api/auctions` | Sí | Crear subasta |
| GET | `/api/auctions/:id` | Opcional | Detalle e historial público vigente de pujas |
| PATCH | `/api/auctions/:id` | Sí/vendedor | Editar datos o cierre |
| POST | `/api/auctions/:id/bids` | Sí | Crear o mejorar puja `{ amount }` |
| DELETE | `/api/auctions/:id/bids/mine` | Sí | Retirar la puja propia antes del cierre |
| GET | `/api/matches/mine` | Sí | Turnos de adjudicación propios |
| POST | `/api/matches/:id/accept` | Sí/candidato | Aceptar y pagar desde fondos congelados |
| POST | `/api/matches/:id/reject` | Sí/candidato | Rechazar y aplicar penalización |

Crear o editar usa los campos `title`, `description`, `category`, `condition`, `startingPrice` (solo al crear), `commune`, `delivery` y `endsAt`. `endsAt` puede ser ISO con offset o una hora de pared sin offset; en este último caso se interpreta usando `America/Santiago`. Siempre se devuelve como UTC ISO y debe quedar al menos tres minutos en el futuro.

## Cierre simple, sin worker

Cada lectura o acción relevante sincroniza primero las subastas vencidas dentro de transacciones con bloqueo de fila. Al llegar `endsAt`, la subasta pasa de `ACTIVE` a `MATCHING`; el mayor postor recibe una ventana lógica de una hora. Si nadie consultó durante un tiempo, la siguiente consulta reconstruye en orden los vencimientos que correspondían. Por eso el estado es correcto sin otro proceso desplegado. El frontend puede hacer polling periódico para que la interfaz se actualice cerca del segundo de cierre.

Al aceptar, el monto congelado se consume: 95% se acredita al vendedor y 5% al administrador. Al rechazar o dejar expirar un turno, 10% va al administrador y 90% vuelve al postor. Los demás fondos permanecen congelados durante la posta y se liberan íntegramente cuando alguien acepta. Si todos rechazan o expiran, queda `NO_MATCH`.

Las fracciones de peso de comisiones se redondean hacia abajo. Cada cambio monetario queda como entrada append-only en `ledger_entries`; un trigger impide actualizar o eliminar ese historial.

## Despliegue

El `Dockerfile` produce un único servicio HTTP. Antes de iniciar una nueva versión ejecuta una tarea puntual con `npm run migrate` y luego `npm run seed`. Conserva `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` en secretos del proveedor. La base de datos debe persistir fuera del contenedor.
