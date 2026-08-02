import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Heart, Gavel, Clock, Truck, MapPin, Star, ShieldCheck, Bitcoin, Wallet,
  CreditCard, Lock, User, X, Check, CheckCircle2, AlertCircle, ChevronRight, ChevronDown,
  ChevronLeft, ArrowRight, ArrowLeft, Eye, TrendingUp, Zap, Building2, BadgeCheck, Info,
  Package, Laptop, Car, Factory, Wrench, Armchair, Shirt, Gem, Bike, Menu, Upload,
  FileText, ShoppingCart, Timer, Coins, LayoutGrid, List, Flag, Share2, Plus, Minus, Hammer
} from "lucide-react";

/* ============================================================
   RematoOnline.cl — subastas en línea
   Estructura tipo eBay · diseño minimalista
   ============================================================ */

const MIN = 60000, HOUR = 3600000, DAY = 86400000;

/* ---------- utilidades ---------- */
const clp = (n) => "$" + Math.round(n).toLocaleString("es-CL");

const incrementoMin = (p) =>
  p < 10000 ? 500 :
  p < 50000 ? 1000 :
  p < 100000 ? 2000 :
  p < 500000 ? 5000 :
  p < 1000000 ? 10000 :
  p < 5000000 ? 20000 : 50000;

const restante = (fin, now) => {
  const ms = fin - now;
  if (ms <= 0) return { ms: 0, texto: "Finalizada", urgente: false, cerrada: true };
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MIN), s = Math.floor((ms % MIN) / 1000);
  const p2 = (x) => String(x).padStart(2, "0");
  let texto;
  if (d > 0) texto = `${d}d ${p2(h)}h ${p2(m)}m`;
  else if (h > 0) texto = `${p2(h)}:${p2(m)}:${p2(s)}`;
  else texto = `${p2(m)}:${p2(s)}`;
  return { ms, texto, urgente: ms < 10 * MIN, cerrada: false };
};

const mask = (nombre) =>
  nombre.length < 3 ? nombre[0] + "***" : nombre[0] + "***" + nombre[nombre.length - 1];

const lote = (id) => "LOTE " + String(id).padStart(4, "0");

/* ---------- catálogo ---------- */
const CATEGORIAS = [
  { id: "tecnologia", nombre: "Tecnología", Icon: Laptop },
  { id: "vehiculos", nombre: "Vehículos", Icon: Car },
  { id: "industrial", nombre: "Industrial", Icon: Factory },
  { id: "herramientas", nombre: "Herramientas", Icon: Wrench },
  { id: "oficina", nombre: "Hogar y Oficina", Icon: Armchair },
  { id: "moda", nombre: "Moda", Icon: Shirt },
  { id: "coleccion", nombre: "Coleccionables", Icon: Gem },
  { id: "deportes", nombre: "Deportes", Icon: Bike },
];

const COMUNAS = [
  "Providencia", "Las Condes", "Ñuñoa", "Santiago Centro", "La Florida", "Maipú",
  "Puente Alto", "Vitacura", "San Miguel", "Quilicura", "Viña del Mar", "Concepción",
];

const REGIONES = [
  "Región Metropolitana", "Valparaíso", "Biobío", "Antofagasta",
  "Maule", "Los Lagos", "O'Higgins", "Coquimbo",
];

/* tarifas del servicio: una sola fuente para todo el sitio */
const TASAS = { BTC: 98500000, USDT: 968, USDC: 970 };
const COMISIONES = {
  vehiculos: 0.04, industrial: 0.05, herramientas: 0.08, tecnologia: 0.08,
  coleccion: 0.08, oficina: 0.10, moda: 0.10, deportes: 0.10,
};
const TOPE_COMISION = 400000;
const UMBRAL_KYC = 1500000;
const comisionDe = (monto, cat) => Math.min(monto * (COMISIONES[cat] ?? 0.08), TOPE_COMISION);

const T = Date.now();

const crearPujas = (base, n, nombres) => {
  const out = [];
  let p = base;
  for (let i = 0; i < n; i++) {
    p += incrementoMin(p);
    out.push({ usuario: nombres[i % nombres.length], monto: p, fecha: T - (n - i) * 47 * MIN });
  }
  return out.reverse();
};

const NOMBRES = ["carolina_m", "jpablo88", "ferretodo_spa", "rvaldes", "mtapia", "andes_ltda", "sgonzalez", "kmuñoz"];

const mkLote = (o) => {
  const pujas = o.nPujas ? crearPujas(o.inicial, o.nPujas, NOMBRES) : [];
  const precio = pujas.length ? pujas[0].monto : o.inicial;
  return {
    ...o,
    pujas,
    precio,
    maxOculto: pujas.length ? precio + incrementoMin(precio) * 2 : 0,
    lider: pujas.length ? pujas[0].usuario : null,
    prorrogas: 0,
    observando: false,
    vendida: false,
  };
};

const LOTES_INICIALES = [
  mkLote({
    id: 42, titulo: "Notebook Lenovo ThinkPad T490 · i5-8365U 16GB 512GB SSD",
    cat: "tecnologia", cond: "Reacondicionado", tipo: "ambos", inicial: 189000, nPujas: 14,
    compraYa: 419000, fin: T + 3 * HOUR + 12 * MIN, Icon: Laptop, crypto: true, destacado: true,
    vendedor: { nombre: "LiquidaTech SpA", rating: 98.6, ventas: 1284, tipo: "empresa", verificado: true },
    region: "Región Metropolitana", envio: 4990, retiro: "Santiago Centro",
    desc: "Equipo corporativo dado de baja, revisado y testeado. Pantalla 14\" FHD sin pixeles muertos, teclado retroiluminado en español, batería con 87% de salud. Carcasa con marcas de uso normal. Incluye cargador original 65W USB-C.",
    specs: [["Procesador", "Intel Core i5-8365U"], ["RAM", "16 GB (8 soldados + 8 SO-DIMM)"], ["Almacenamiento", "SSD NVMe 512 GB"], ["Pantalla", "14\" IPS 1920×1080"], ["Batería", "87% de salud"], ["Sistema", "Windows 11 Pro activado"]],
    cantidad: 1,
  }),
  mkLote({
    id: 77, titulo: "Lote 20 sillas ergonómicas de oficina · malla negra",
    cat: "oficina", cond: "Usado", tipo: "subasta", inicial: 240000, nPujas: 9,
    fin: T + 8 * MIN, Icon: Armchair, crypto: true, destacado: true,
    vendedor: { nombre: "Síndico Concursal RM", rating: 99.1, ventas: 342, tipo: "empresa", verificado: true },
    region: "Región Metropolitana", envio: 0, retiro: "Quilicura (retiro obligatorio)",
    desc: "Lote completo proveniente de cierre de oficinas. 20 unidades con apoyabrazos regulables, 3 con tapiz rasgado. Se vende como lote indivisible. Retiro con transporte propio dentro de 5 días hábiles.",
    specs: [["Unidades", "20"], ["Estado", "17 buenas / 3 con daño menor"], ["Origen", "Liquidación de oficina"], ["Retiro", "Obligatorio, Quilicura"]],
    cantidad: 20,
  }),
  mkLote({
    id: 103, titulo: "Camioneta Toyota Hilux 2.4 4x4 2018 · 142.000 km",
    cat: "vehiculos", cond: "Usado", tipo: "subasta", inicial: 9800000, nPujas: 22,
    fin: T + 2 * DAY + 5 * HOUR, Icon: Car, crypto: true, destacado: true, reserva: 13500000,
    vendedor: { nombre: "Remates Andes Ltda.", rating: 97.2, ventas: 891, tipo: "empresa", verificado: true },
    region: "Valparaíso", envio: 0, retiro: "Viña del Mar",
    desc: "Único dueño empresa, mantenciones al día en concesionario. Documentación en regla, permiso de circulación vigente. Se entrega con transferencia iniciada. Visitas a la unidad de lunes a viernes con cita previa.",
    specs: [["Año", "2018"], ["Kilometraje", "142.000 km"], ["Motor", "2.4 diésel"], ["Transmisión", "Manual 4x4"], ["Documentos", "Al día"]],
    cantidad: 1,
  }),
  mkLote({
    id: 118, titulo: "Torno CNC Haas ST-10 · año 2016, operativo",
    cat: "industrial", cond: "Usado", tipo: "subasta", inicial: 14000000, nPujas: 6,
    fin: T + 4 * DAY + 2 * HOUR, Icon: Factory, crypto: true, reserva: 22000000,
    vendedor: { nombre: "Metalúrgica Sur en liquidación", rating: 96.4, ventas: 57, tipo: "empresa", verificado: true },
    region: "Biobío", envio: 0, retiro: "Talcahuano",
    desc: "Máquina en funcionamiento, se entrega encendida en demostración. Incluye torreta de 12 herramientas y contrapunto. Desmontaje y flete por cuenta del comprador.",
    specs: [["Marca", "Haas"], ["Modelo", "ST-10"], ["Año", "2016"], ["Horas husillo", "9.400"], ["Alimentación", "380V trifásica"]],
    cantidad: 1,
  }),
  mkLote({
    id: 155, titulo: "iPhone 13 128GB · desbloqueado, batería 91%",
    cat: "tecnologia", cond: "Usado", tipo: "ambos", inicial: 249000, nPujas: 18,
    compraYa: 429000, fin: T + 41 * MIN, Icon: Laptop, crypto: true, destacado: true,
    vendedor: { nombre: "carolina_m", rating: 100, ventas: 46, tipo: "particular", verificado: true },
    region: "Región Metropolitana", envio: 3990, retiro: "Providencia",
    desc: "Vendo por cambio de equipo. Sin golpes ni rayas en pantalla, siempre con lámina y carcasa. Incluye caja y cable. Liberado de fábrica, funciona con cualquier operador.",
    specs: [["Almacenamiento", "128 GB"], ["Batería", "91%"], ["Color", "Medianoche"], ["Accesorios", "Caja y cable USB-C"]],
    cantidad: 1,
  }),
  mkLote({
    id: 161, titulo: "Compresor industrial Kaeser 15HP · estanque 500L",
    cat: "industrial", cond: "Usado", tipo: "subasta", inicial: 1200000, nPujas: 11,
    fin: T + 22 * HOUR, Icon: Factory, crypto: false,
    vendedor: { nombre: "Industrias Norte SpA", rating: 95.8, ventas: 203, tipo: "empresa", verificado: true },
    region: "Antofagasta", envio: 0, retiro: "Antofagasta",
    desc: "Compresor de tornillo con estanque, mantención realizada hace 300 horas. Funcionando al momento de la publicación.",
    specs: [["Potencia", "15 HP"], ["Estanque", "500 litros"], ["Tipo", "Tornillo rotativo"]],
    cantidad: 1,
  }),
  mkLote({
    id: 174, titulo: "Set 8 herramientas eléctricas Bosch Professional",
    cat: "herramientas", cond: "Nuevo", tipo: "ambos", inicial: 320000, nPujas: 15,
    compraYa: 749000, fin: T + 6 * HOUR + 40 * MIN, Icon: Wrench, crypto: true,
    vendedor: { nombre: "FerreTodo SpA", rating: 98.9, ventas: 2410, tipo: "empresa", verificado: true },
    region: "Región Metropolitana", envio: 5990, retiro: "Estación Central",
    desc: "Stock nuevo con caja sellada, excedente de importación. Incluye taladro percutor, esmeril angular, sierra circular, lijadora orbital, atornillador de impacto, rotomartillo, caladora y multiherramienta.",
    specs: [["Piezas", "8"], ["Garantía", "12 meses"], ["Voltaje", "220V"], ["Origen", "Excedente de importación"]],
    cantidad: 8,
  }),
  mkLote({
    id: 188, titulo: "Bicicleta Trek Marlin 7 aro 29 · talla M",
    cat: "deportes", cond: "Usado", tipo: "subasta", inicial: 180000, nPujas: 7,
    fin: T + 1 * DAY + 3 * HOUR, Icon: Bike, crypto: true,
    vendedor: { nombre: "jpablo88", rating: 99.4, ventas: 88, tipo: "particular", verificado: true },
    region: "Los Lagos", envio: 12990, retiro: "Puerto Varas",
    desc: "Poco uso, guardada bajo techo. Cambios Shimano recién ajustados, neumáticos con 80% de vida útil.",
    specs: [["Aro", "29\""], ["Talla", "M"], ["Cambios", "Shimano Deore 1×10"], ["Frenos", "Hidráulicos"]],
    cantidad: 1,
  }),
  mkLote({
    id: 195, titulo: "Lote 40 poleras algodón peinado · tallas surtidas",
    cat: "moda", cond: "Nuevo", tipo: "compraYa", inicial: 0, nPujas: 0,
    compraYa: 158000, fin: T + 12 * DAY, Icon: Shirt, crypto: true,
    vendedor: { nombre: "Textil Maule Ltda.", rating: 94.7, ventas: 621, tipo: "empresa", verificado: true },
    region: "Maule", envio: 6990, retiro: "Talca",
    desc: "Saldo de producción sin fallas. Colores blanco, negro y gris. Tallas S a XL surtidas.",
    specs: [["Unidades", "40"], ["Material", "Algodón peinado 180g"], ["Tallas", "S a XL"]],
    cantidad: 40,
  }),
  mkLote({
    id: 207, titulo: "Moneda de plata 1 oz · Krugerrand 2020",
    cat: "coleccion", cond: "Nuevo", tipo: "subasta", inicial: 28000, nPujas: 12,
    fin: T + 3 * MIN, Icon: Gem, crypto: true,
    vendedor: { nombre: "rvaldes", rating: 99.8, ventas: 312, tipo: "particular", verificado: true },
    region: "Región Metropolitana", envio: 3490, retiro: "Las Condes",
    desc: "Moneda encapsulada, sin circular. Se envía con seguimiento y seguro incluido.",
    specs: [["Metal", "Plata .999"], ["Peso", "1 onza troy"], ["Año", "2020"], ["Estado", "Sin circular"]],
    cantidad: 1,
  }),
  mkLote({
    id: 213, titulo: "Monitor Dell UltraSharp 27\" 4K · U2720Q",
    cat: "tecnologia", cond: "Reacondicionado", tipo: "ambos", inicial: 119000, nPujas: 10,
    compraYa: 289000, fin: T + 19 * HOUR, Icon: Laptop, crypto: true,
    vendedor: { nombre: "LiquidaTech SpA", rating: 98.6, ventas: 1284, tipo: "empresa", verificado: true },
    region: "Región Metropolitana", envio: 6990, retiro: "Santiago Centro",
    desc: "Panel IPS 4K con USB-C 90W. Sin pixeles muertos, base original incluida.",
    specs: [["Tamaño", "27 pulgadas"], ["Resolución", "3840×2160"], ["Conectividad", "USB-C 90W, HDMI, DP"]],
    cantidad: 1,
  }),
  mkLote({
    id: 229, titulo: "Grúa horquilla Toyota 2.5 ton · gas licuado",
    cat: "industrial", cond: "Usado", tipo: "subasta", inicial: 3900000, nPujas: 8,
    fin: T + 5 * HOUR + 15 * MIN, Icon: Factory, crypto: false,
    vendedor: { nombre: "Bodegas Centro SpA", rating: 97.9, ventas: 144, tipo: "empresa", verificado: true },
    region: "O'Higgins", envio: 0, retiro: "Rancagua",
    desc: "Equipo operativo con 6.200 horas. Mantención preventiva al día, se entrega con bitácora.",
    specs: [["Capacidad", "2.500 kg"], ["Horas", "6.200"], ["Combustible", "Gas licuado"]],
    cantidad: 1,
  }),
];

/* ---------- estilos base ---------- */
const S = {
  card: "border border-zinc-200 bg-white",
  btn: "inline-flex items-center justify-center gap-2 bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:bg-zinc-300",
  btnGhost: "inline-flex items-center justify-center gap-2 border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
  input: "w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none",
  label: "text-xs font-medium uppercase tracking-widest text-zinc-500",
  mono: "font-mono tabular-nums",
};

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [now, setNow] = useState(Date.now());
  const [lotes, setLotes] = useState(LOTES_INICIALES);
  const [ruta, setRuta] = useState({ v: "home" });
  const [usuario, setUsuario] = useState(null);
  const [auth, setAuth] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const [tape, setTape] = useState([]);
  const [q, setQ] = useState("");
  const [catSel, setCatSel] = useState("todas");
  const pendiente = useRef(null);
  const lotesRef = useRef(lotes);
  lotesRef.current = lotes;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ir = (v, params = {}) => {
    setRuta({ v, ...params });
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  const avisar = (texto, tipo = "info") => {
    const id = Math.random().toString(36).slice(2);
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 5200);
  };

  /* ---- motor de pujas: puja automática + incremento + prórroga ---- */
  const resolver = (l, maxNuevo, quien, ahora) => {
    let precio, lider, maxOculto;
    if (!l.pujas.length) {
      precio = l.precio; lider = quien; maxOculto = maxNuevo;
    } else if (maxNuevo > l.maxOculto) {
      lider = quien;
      maxOculto = maxNuevo;
      precio = Math.min(maxNuevo, l.maxOculto + incrementoMin(l.maxOculto));
    } else {
      lider = l.lider;
      maxOculto = l.maxOculto;
      precio = Math.min(l.maxOculto, maxNuevo + incrementoMin(maxNuevo));
    }
    // prórroga: una puja en los últimos 2 minutos corre el cierre otros 2 minutos
    let fin = l.fin, prorrogas = l.prorrogas;
    if (fin - ahora < 2 * MIN) { fin = ahora + 2 * MIN; prorrogas += 1; }
    return {
      precio, lider, maxOculto, fin, prorrogas,
      pujas: [{ usuario: quien, monto: precio, fecha: ahora }, ...l.pujas],
    };
  };

  const pujar = (loteId, maxUsuario, quien) => {
    const l = lotesRef.current.find((x) => x.id === loteId);
    if (!l) return { ok: false, msg: "Lote no encontrado." };
    const ahora = Date.now();
    if (ahora >= l.fin) return { ok: false, msg: "La subasta ya cerró." };
    const minimo = l.pujas.length ? l.precio + incrementoMin(l.precio) : l.precio;
    if (maxUsuario < minimo) return { ok: false, msg: `La puja mínima es ${clp(minimo)}.` };
    if (l.lider === quien && maxUsuario <= l.maxOculto)
      return { ok: false, msg: "Ya eres el mejor postor con un máximo mayor." };

    const c = resolver(l, maxUsuario, quien, ahora);
    setLotes((prev) => prev.map((x) => (x.id === loteId ? { ...x, ...c } : x)));
    setTape((tp) => [{ id: Math.random() + ahora, loteId: l.id, monto: c.precio, t: ahora }, ...tp].slice(0, 14));
    return {
      ok: true,
      lider: c.lider === quien,
      precio: c.precio,
      msg: c.lider === quien
        ? `Vas ganando ${lote(l.id)} en ${clp(c.precio)}.`
        : `Te superaron en ${lote(l.id)}. Va en ${clp(c.precio)}.`,
    };
  };

  const pujarUsuario = (loteId, monto) => {
    if (!usuario) { pendiente.current = { loteId, monto }; setAuth(true); return; }
    const r = pujar(loteId, monto, usuario.nombre);
    avisar(r.msg, r.ok ? (r.lider ? "ok" : "alerta") : "error");
  };

  /* ---- postores automáticos: mantienen las subastas vivas ---- */
  useEffect(() => {
    const t = setInterval(() => {
      const ahora = Date.now();
      const activos = lotesRef.current.filter(
        (l) => ahora < l.fin && l.pujas.length > 0 && l.fin - ahora < 8 * HOUR && l.tipo !== "compraYa"
      );
      if (!activos.length) return;
      const objetivo = activos[Math.floor(Math.random() * activos.length)];
      const bot = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
      if (bot === objetivo.lider) return;
      const maxBot = objetivo.precio + incrementoMin(objetivo.precio) * (1 + Math.floor(Math.random() * 3));
      const c = resolver(objetivo, maxBot, bot, ahora);
      setLotes((prev) => prev.map((x) => (x.id === objetivo.id ? { ...x, ...c } : x)));
      setTape((tp) => [{ id: Math.random() + ahora, loteId: objetivo.id, monto: c.precio, t: ahora }, ...tp].slice(0, 14));
      if (usuario && objetivo.lider === usuario.nombre && c.lider !== usuario.nombre) {
        avisar(`Te superaron en ${lote(objetivo.id)}. Va en ${clp(c.precio)}.`, "alerta");
      }
    }, 7000);
    return () => clearInterval(t);
  }, [usuario]);

  const observar = (id) => {
    if (!usuario) { setAuth(true); return; }
    setLotes((prev) => prev.map((l) => (l.id === id ? { ...l, observando: !l.observando } : l)));
  };

  const entrar = (nombre) => {
    setUsuario({ nombre, kyc: "sin verificar", desde: "2026" });
    setAuth(false);
    avisar(`Sesión iniciada como ${nombre}.`, "ok");
    if (pendiente.current) {
      const { loteId, monto } = pendiente.current;
      pendiente.current = null;
      setTimeout(() => {
        const r = pujar(loteId, monto, nombre);
        avisar(r.msg, r.ok ? (r.lider ? "ok" : "alerta") : "error");
      }, 80);
    }
  };

  const buscar = (texto, cat) => {
    setQ(texto); setCatSel(cat || "todas");
    ir("buscar", { q: texto, cat: cat || "todas" });
  };

  const publicar = (nuevo) => {
    const id = 300 + Math.floor(Math.random() * 600);
    const l = mkLote({ ...nuevo, id, nPujas: 0 });
    setLotes((prev) => [l, ...prev]);
    avisar("Publicado. Ya está recibiendo pujas.", "ok");
    ir("lote", { id });
  };

  const loteActual = lotes.find((l) => l.id === ruta.id);
  const observados = lotes.filter((l) => l.observando);
  const misPujas = usuario ? lotes.filter((l) => l.pujas.some((p) => p.usuario === usuario.nombre)) : [];

  const ctx = { lotes, now, ir, usuario, pujarUsuario, observar, avisar, setAuth };

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
      <style>{`
        @keyframes rmt-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        .rmt-in { animation: rmt-in .28s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .rmt-in, .animate-pulse { animation: none !important; } }
        .rmt-tape::-webkit-scrollbar { display: none; }
        .rmt-tape { scrollbar-width: none; }
      `}</style>

      <Header
        ir={ir} usuario={usuario} setAuth={setAuth} buscar={buscar}
        observados={observados.length} q={q} setQ={setQ} catSel={catSel} setCatSel={setCatSel}
      />
      <Tape tape={tape} ir={ir} now={now} />

      <main className="mx-auto max-w-7xl px-4 pb-24">
        {ruta.v === "home" && <Home {...ctx} buscar={buscar} />}
        {ruta.v === "buscar" && <Buscar {...ctx} q={ruta.q} cat={ruta.cat} vendedor={ruta.vendedor} />}
        {ruta.v === "lote" && loteActual && <Ficha {...ctx} l={loteActual} />}
        {ruta.v === "vender" && <Vender publicar={publicar} usuario={usuario} setAuth={setAuth} ir={ir} />}
        {ruta.v === "cuenta" && <Cuenta {...ctx} misPujas={misPujas} observados={observados} setUsuario={setUsuario} />}
        {ruta.v === "pagar" && loteActual && <Pagar {...ctx} l={loteActual} />}
        {ruta.v === "pagina" && <Pagina {...ctx} slug={ruta.slug} />}
      </main>

      <Footer ir={ir} />
      <Avisos avisos={avisos} />
      {auth && <Entrar entrar={entrar} cerrar={() => setAuth(false)} />}
    </div>
  );
}

/* ============================================================
   CABECERA
   ============================================================ */
function Header({ ir, usuario, setAuth, buscar, observados, q, setQ, catSel, setCatSel }) {
  const [menu, setMenu] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <button onClick={() => ir("home")} className="flex shrink-0 items-baseline gap-0 focus:outline-none">
          <span className="text-xl font-semibold tracking-tighter">remato</span>
          <span className="text-xl font-light tracking-tighter text-zinc-400">online</span>
          <span className={`ml-0.5 text-xs ${S.mono} text-zinc-400`}>.cl</span>
        </button>

        <div className="hidden flex-1 items-stretch border border-zinc-900 md:flex">
          <select
            value={catSel} onChange={(e) => setCatSel(e.target.value)}
            className="border-r border-zinc-200 bg-white px-3 text-xs text-zinc-600 focus:outline-none"
          >
            <option value="todas">Todas</option>
            {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar(q, catSel)}
            placeholder="Busca un lote, marca o modelo"
            className="flex-1 px-3 py-2.5 text-sm placeholder-zinc-400 focus:outline-none"
          />
          <button onClick={() => buscar(q, catSel)} className="bg-zinc-900 px-6 text-white transition hover:bg-zinc-700">
            <Search size={16} />
          </button>
        </div>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          <button onClick={() => ir("vender")} className="hidden px-3 py-2 font-medium hover:text-zinc-500 sm:block">Vender</button>
          <button onClick={() => abrir(ir, "ayuda/centro")} className="hidden px-3 py-2 hover:text-zinc-500 md:block">Ayuda</button>
          <button onClick={() => ir("cuenta")} className="relative px-3 py-2 hover:text-zinc-500">
            <Heart size={18} />
            {observados > 0 && (
              <span className={`absolute right-0 top-0 bg-zinc-900 px-1 text-xs leading-4 text-white ${S.mono}`}>{observados}</span>
            )}
          </button>
          {usuario ? (
            <button onClick={() => ir("cuenta")} className="flex items-center gap-2 px-3 py-2 hover:text-zinc-500">
              <User size={18} /><span className="hidden text-sm sm:inline">{usuario.nombre}</span>
            </button>
          ) : (
            <button onClick={() => setAuth(true)} className="px-3 py-2 font-medium hover:text-zinc-500">Ingresar</button>
          )}
          <button onClick={() => setMenu(!menu)} className="px-2 py-2 md:hidden"><Menu size={18} /></button>
        </nav>
      </div>

      <div className="flex gap-2 border-t border-zinc-100 px-4 py-2 md:hidden">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar(q, catSel)}
          placeholder="Buscar" className={S.input}
        />
        <button onClick={() => buscar(q, catSel)} className="bg-zinc-900 px-4 text-white"><Search size={16} /></button>
      </div>

      <div className={`${menu ? "block" : "hidden"} border-t border-zinc-100 md:block`}>
        <div className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 py-2 text-xs text-zinc-600 rmt-tape">
          {CATEGORIAS.map((c) => (
            <button key={c.id} onClick={() => { setMenu(false); buscar("", c.id); }} className="whitespace-nowrap py-1 transition hover:text-zinc-900">
              {c.nombre}
            </button>
          ))}
          <button onClick={() => { setMenu(false); ir("vender"); }} className="whitespace-nowrap py-1 font-medium text-zinc-900 sm:hidden">Vender</button>
        </div>
      </div>
    </header>
  );
}

/* ---------- cinta de pujas en vivo (elemento distintivo) ---------- */
function Tape({ tape, ir, now }) {
  if (!tape.length) return null;
  return (
    <div className="border-b border-zinc-200 bg-zinc-900">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-1.5">
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-white">
          <span className="h-1.5 w-1.5 animate-pulse bg-red-500" /> En vivo
        </span>
        <div className="flex gap-6 overflow-x-auto rmt-tape">
          {tape.map((t) => (
            <button key={t.id} onClick={() => ir("lote", { id: t.loteId })}
              className={`rmt-in flex shrink-0 items-center gap-2 text-xs text-zinc-400 transition hover:text-white ${S.mono}`}>
              <span className="text-zinc-500">{lote(t.loteId)}</span>
              <span className="text-white">{clp(t.monto)}</span>
              <span className="text-zinc-600">hace {Math.max(0, Math.round((now - t.t) / 1000))}s</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PORTADA
   ============================================================ */
function Home({ lotes, now, ir, observar, buscar, pujarUsuario, usuario }) {
  const activos = lotes.filter((l) => now < l.fin);
  const cerrando = [...activos].sort((a, b) => a.fin - b.fin).slice(0, 4);
  const destacados = activos.filter((l) => l.destacado);
  const resto = activos.filter((l) => !l.destacado);
  const totalPujas = lotes.reduce((s, l) => s + l.pujas.length, 0);

  return (
    <div>
      {/* Portada: el reloj es el titular */}
      <section className="grid gap-8 border-b border-zinc-200 py-12 md:grid-cols-12 md:py-16">
        <div className="md:col-span-7">
          <p className={`${S.label} mb-4`}>Subastas en línea · Chile</p>
          <h1 className="text-4xl font-semibold leading-none tracking-tighter sm:text-6xl">
            Todo lo que una empresa deja atrás,<br />
            <span className="text-zinc-400">al precio que tú decidas.</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-zinc-600">
            Remates de liquidaciones, saldos de stock y ventas entre particulares. Pujas en tiempo real,
            pago retenido hasta que recibes tu compra, y la opción de pagar en pesos o en cripto.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={() => buscar("", "todas")} className={S.btn}>
              Ver lotes abiertos <ArrowRight size={16} />
            </button>
            <button onClick={() => ir("vender")} className={S.btnGhost}>Vender un lote</button>
          </div>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-zinc-200 pt-6">
            {[["Lotes abiertos", activos.length], ["Pujas registradas", totalPujas], ["Comisión de compra", "0%"]].map(([k, v]) => (
              <div key={k}>
                <div className={`text-2xl font-medium tracking-tight ${S.mono}`}>{v}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-zinc-500">{k}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-5">
          <div className="border border-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
              <span className={`${S.label}`}>Cierra primero</span>
              <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-red-600">
                <span className="h-1.5 w-1.5 animate-pulse bg-red-600" /> Directo
              </span>
            </div>
            <ul className="divide-y divide-zinc-100">
              {cerrando.map((l) => {
                const r = restante(l.fin, now);
                return (
                  <li key={l.id}>
                    <button onClick={() => ir("lote", { id: l.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-zinc-100 text-zinc-500"><l.Icon size={18} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{l.titulo}</div>
                        <div className={`mt-0.5 text-xs text-zinc-500 ${S.mono}`}>{lote(l.id)} · {l.pujas.length} pujas</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-sm font-medium ${S.mono}`}>{clp(l.precio)}</div>
                        <div className={`text-xs ${S.mono} ${r.urgente ? "text-red-600" : "text-zinc-500"}`}>{r.texto}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="border-b border-zinc-200 py-8">
        <div className="grid grid-cols-2 gap-px bg-zinc-200 sm:grid-cols-4 lg:grid-cols-8">
          {CATEGORIAS.map((c) => {
            const n = activos.filter((l) => l.cat === c.id).length;
            return (
              <button key={c.id} onClick={() => buscar("", c.id)}
                className="group flex flex-col items-center gap-2 bg-white px-2 py-5 transition hover:bg-zinc-50">
                <c.Icon size={20} className="text-zinc-400 transition group-hover:text-zinc-900" />
                <span className="text-xs font-medium">{c.nombre}</span>
                <span className={`text-xs text-zinc-400 ${S.mono}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </section>

      <Seccion titulo="Destacados de la semana" sub="Seleccionados por volumen de pujas">
        <Grilla lotes={destacados} now={now} ir={ir} observar={observar} />
      </Seccion>

      <Seccion titulo="Abiertos ahora" sub="Todos los lotes recibiendo pujas">
        <Grilla lotes={resto} now={now} ir={ir} observar={observar} />
      </Seccion>

      {/* Cómo funciona */}
      <section className="mt-14 border-t border-zinc-200 pt-10">
        <h2 className="text-xl font-semibold tracking-tight">Cómo funciona una compra</h2>
        <div className="mt-6 grid gap-px bg-zinc-200 md:grid-cols-4">
          {[
            { n: "01", t: "Pujas o compras ya", d: "Fijas tu máximo y el sistema puja por ti hasta ese tope, de a un incremento por vez." },
            { n: "02", t: "Pagas y se retiene", d: "Tu dinero queda retenido en custodia. El vendedor ve el pago confirmado, pero no lo recibe todavía." },
            { n: "03", t: "El vendedor despacha", d: "Tiene 3 días hábiles para entregar el seguimiento o coordinar el retiro del lote." },
            { n: "04", t: "Confirmas y se libera", d: "Al confirmar la recepción se liberan los fondos. Tienes 5 días para revisar y reclamar." },
          ].map((p) => (
            <div key={p.n} className="bg-white p-5">
              <div className={`text-xs text-zinc-400 ${S.mono}`}>{p.n}</div>
              <div className="mt-2 text-sm font-medium">{p.t}</div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">{p.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => abrir(ir, "comprar/como-pujar")} className={S.btnGhost}>Cómo pujar paso a paso</button>
          <button onClick={() => abrir(ir, "comprar/proteccion")} className={S.btnGhost}>Protección al comprador</button>
          <button onClick={() => abrir(ir, "comprar/cripto")} className={S.btnGhost}>Pagar con cripto</button>
          <button onClick={() => abrir(ir, "comprar/reglas")} className={S.btnGhost}>Reglas del comprador</button>
        </div>
      </section>
    </div>
  );
}

function Seccion({ titulo, sub, children }) {
  return (
    <section className="py-10">
      <div className="mb-5 flex items-end justify-between border-b border-zinc-200 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{titulo}</h2>
          {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ---------- tarjeta de lote ---------- */
function Grilla({ lotes, now, ir, observar, lista = false }) {
  if (!lotes.length)
    return (
      <div className="border border-dashed border-zinc-300 px-6 py-16 text-center">
        <p className="text-sm font-medium">No hay lotes con esos filtros</p>
        <p className="mt-1 text-xs text-zinc-500">Prueba con menos filtros o revisa otra categoría.</p>
      </div>
    );
  if (lista)
    return (
      <ul className="divide-y divide-zinc-200 border-y border-zinc-200">
        {lotes.map((l) => <Fila key={l.id} l={l} now={now} ir={ir} observar={observar} />)}
      </ul>
    );
  return (
    <div className="grid grid-cols-2 gap-px bg-zinc-200 lg:grid-cols-4">
      {lotes.map((l) => <Tarjeta key={l.id} l={l} now={now} ir={ir} observar={observar} />)}
    </div>
  );
}

function Tarjeta({ l, now, ir, observar }) {
  const r = restante(l.fin, now);
  return (
    <article className="group flex flex-col bg-white">
      <div className="relative">
        <button onClick={() => ir("lote", { id: l.id })} className="block w-full">
          <div className="flex aspect-square items-center justify-center bg-zinc-50 transition group-hover:bg-zinc-100">
            <l.Icon size={44} strokeWidth={1} className="text-zinc-300 transition group-hover:text-zinc-400" />
          </div>
        </button>
        <button onClick={() => observar(l.id)}
          aria-label="Guardar en observados"
          className="absolute right-2 top-2 border border-zinc-200 bg-white p-1.5 transition hover:border-zinc-900">
          <Heart size={14} className={l.observando ? "fill-zinc-900 text-zinc-900" : "text-zinc-400"} />
        </button>
        {r.urgente && !r.cerrada && (
          <span className={`absolute left-2 top-2 bg-red-600 px-1.5 py-0.5 text-xs text-white ${S.mono}`}>{r.texto}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className={`text-xs text-zinc-400 ${S.mono}`}>{lote(l.id)} · {l.cond}</div>
        <button onClick={() => ir("lote", { id: l.id })} className="mt-1 text-left text-sm leading-snug hover:underline">
          {l.titulo}
        </button>
        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2">
            <span className={`text-base font-medium ${S.mono}`}>{clp(l.precio || l.compraYa)}</span>
            {l.tipo !== "compraYa" && <span className={`text-xs text-zinc-500 ${S.mono}`}>{l.pujas.length} pujas</span>}
          </div>
          {l.compraYa && l.tipo !== "compraYa" && (
            <div className={`text-xs text-zinc-500 ${S.mono}`}>Cómpralo ya {clp(l.compraYa)}</div>
          )}
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
            <span className={`flex items-center gap-1 ${S.mono} ${r.urgente ? "text-red-600" : ""}`}>
              <Clock size={11} />{r.texto}
            </span>
            {l.crypto && <span className={`flex items-center gap-1 text-amber-600 ${S.mono}`}><Bitcoin size={11} />cripto</span>}
          </div>
        </div>
      </div>
    </article>
  );
}

function Fila({ l, now, ir, observar }) {
  const r = restante(l.fin, now);
  return (
    <li className="flex gap-4 py-4">
      <button onClick={() => ir("lote", { id: l.id })} className="flex h-28 w-28 shrink-0 items-center justify-center bg-zinc-50">
        <l.Icon size={32} strokeWidth={1} className="text-zinc-300" />
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-xs text-zinc-400 ${S.mono}`}>{lote(l.id)} · {l.cond} · {l.region}</div>
        <button onClick={() => ir("lote", { id: l.id })} className="mt-1 text-left text-sm font-medium hover:underline">{l.titulo}</button>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          {l.vendedor.tipo === "empresa" ? <Building2 size={12} /> : <User size={12} />}
          {l.vendedor.nombre}
          {l.vendedor.verificado && <BadgeCheck size={12} className="text-zinc-900" />}
          <span className={S.mono}>{l.vendedor.rating}%</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><Truck size={11} />{l.envio ? clp(l.envio) : "Solo retiro"}</span>
          {l.crypto && <span className="flex items-center gap-1 text-amber-600"><Bitcoin size={11} />Acepta cripto</span>}
          {l.reserva && <span>Con precio de reserva</span>}
        </div>
      </div>
      <div className="w-36 shrink-0 text-right">
        <div className={`text-lg font-medium ${S.mono}`}>{clp(l.precio || l.compraYa)}</div>
        <div className={`text-xs text-zinc-500 ${S.mono}`}>{l.pujas.length} pujas</div>
        <div className={`mt-1 text-xs ${S.mono} ${r.urgente ? "text-red-600" : "text-zinc-500"}`}>{r.texto}</div>
        <button onClick={() => observar(l.id)} className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
          <Heart size={12} className={l.observando ? "fill-zinc-900 text-zinc-900" : ""} />
          {l.observando ? "Guardado" : "Guardar"}
        </button>
      </div>
    </li>
  );
}

/* ============================================================
   RESULTADOS
   ============================================================ */
function Buscar({ lotes, now, ir, observar, q, cat, vendedor }) {
  const [filtros, setFiltros] = useState({
    cat: cat || "todas", cond: [], tipo: "todos", crypto: false,
    empresa: false, region: "todas", min: "", max: "",
  });
  const [orden, setOrden] = useState("cierre");
  const [vista, setVista] = useState("grilla");

  useEffect(() => setFiltros((f) => ({ ...f, cat: cat || "todas" })), [cat]);

  const toggleCond = (c) =>
    setFiltros((f) => ({ ...f, cond: f.cond.includes(c) ? f.cond.filter((x) => x !== c) : [...f.cond, c] }));

  const resultados = useMemo(() => {
    let out = lotes.filter((l) => now < l.fin);
    if (q) out = out.filter((l) => (l.titulo + " " + l.desc).toLowerCase().includes(q.toLowerCase()));
    if (filtros.cat !== "todas") out = out.filter((l) => l.cat === filtros.cat);
    if (filtros.cond.length) out = out.filter((l) => filtros.cond.includes(l.cond));
    if (filtros.tipo === "subasta") out = out.filter((l) => l.tipo !== "compraYa");
    if (filtros.tipo === "compraYa") out = out.filter((l) => !!l.compraYa);
    if (filtros.crypto) out = out.filter((l) => l.crypto);
    if (filtros.empresa) out = out.filter((l) => l.vendedor.tipo === "empresa");
    if (filtros.region !== "todas") out = out.filter((l) => l.region === filtros.region);
    if (vendedor) out = out.filter((l) => l.vendedor.nombre === vendedor);
    if (filtros.min) out = out.filter((l) => (l.precio || l.compraYa) >= Number(filtros.min));
    if (filtros.max) out = out.filter((l) => (l.precio || l.compraYa) <= Number(filtros.max));
    const key = (l) => l.precio || l.compraYa;
    if (orden === "cierre") out = [...out].sort((a, b) => a.fin - b.fin);
    if (orden === "barato") out = [...out].sort((a, b) => key(a) - key(b));
    if (orden === "caro") out = [...out].sort((a, b) => key(b) - key(a));
    if (orden === "pujas") out = [...out].sort((a, b) => b.pujas.length - a.pujas.length);
    return out;
  }, [lotes, q, filtros, orden, now, vendedor]);

  const Check_ = ({ on, onClick, children }) => (
    <button onClick={onClick} className="flex w-full items-center gap-2 py-1.5 text-left text-sm text-zinc-700 hover:text-zinc-900">
      <span className={`flex h-4 w-4 items-center justify-center border ${on ? "border-zinc-900 bg-zinc-900" : "border-zinc-300"}`}>
        {on && <Check size={11} className="text-white" />}
      </span>
      {children}
    </button>
  );

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center gap-1 text-xs text-zinc-500">
        <button onClick={() => ir("home")} className="hover:text-zinc-900">Inicio</button>
        <ChevronRight size={12} />
        <span className="text-zinc-900">
          {filtros.cat === "todas" ? "Todos los lotes" : CATEGORIAS.find((c) => c.id === filtros.cat)?.nombre}
        </span>
      </div>

      <div className="grid gap-8 md:grid-cols-4">
        {/* filtros */}
        <aside className="md:col-span-1">
          <div className="space-y-6 border-t border-zinc-900 pt-4">
            <div>
              <p className={S.label}>Categoría</p>
              <div className="mt-2 space-y-1">
                <button onClick={() => setFiltros((f) => ({ ...f, cat: "todas" }))}
                  className={`block text-sm ${filtros.cat === "todas" ? "font-medium text-zinc-900" : "text-zinc-600 hover:text-zinc-900"}`}>
                  Todas
                </button>
                {CATEGORIAS.map((c) => (
                  <button key={c.id} onClick={() => setFiltros((f) => ({ ...f, cat: c.id }))}
                    className={`block text-sm ${filtros.cat === c.id ? "font-medium text-zinc-900" : "text-zinc-600 hover:text-zinc-900"}`}>
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-4">
              <p className={S.label}>Formato</p>
              <div className="mt-2 flex gap-1">
                {[["todos", "Todos"], ["subasta", "Subasta"], ["compraYa", "Cómpralo ya"]].map(([v, t]) => (
                  <button key={v} onClick={() => setFiltros((f) => ({ ...f, tipo: v }))}
                    className={`border px-2 py-1 text-xs ${filtros.tipo === v ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-600"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-4">
              <p className={S.label}>Estado</p>
              <div className="mt-2">
                {["Nuevo", "Usado", "Reacondicionado"].map((c) => (
                  <Check_ key={c} on={filtros.cond.includes(c)} onClick={() => toggleCond(c)}>{c}</Check_>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-4">
              <p className={S.label}>Precio</p>
              <div className="mt-2 flex items-center gap-2">
                <input value={filtros.min} onChange={(e) => setFiltros((f) => ({ ...f, min: e.target.value }))}
                  placeholder="Mín" inputMode="numeric" className={`${S.input} ${S.mono}`} />
                <span className="text-zinc-400">–</span>
                <input value={filtros.max} onChange={(e) => setFiltros((f) => ({ ...f, max: e.target.value }))}
                  placeholder="Máx" inputMode="numeric" className={`${S.input} ${S.mono}`} />
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-4">
              <p className={S.label}>Pago y vendedor</p>
              <div className="mt-2">
                <Check_ on={filtros.crypto} onClick={() => setFiltros((f) => ({ ...f, crypto: !f.crypto }))}>Acepta cripto</Check_>
                <Check_ on={filtros.empresa} onClick={() => setFiltros((f) => ({ ...f, empresa: !f.empresa }))}>Solo empresas</Check_>
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-4">
              <p className={S.label}>Región</p>
              <select value={filtros.region} onChange={(e) => setFiltros((f) => ({ ...f, region: e.target.value }))}
                className={`${S.input} mt-2`}>
                <option value="todas">Todas</option>
                {REGIONES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </aside>

        {/* resultados */}
        <div className="md:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
            <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <span><span className={`font-medium text-zinc-900 ${S.mono}`}>{resultados.length}</span> lotes</span>
              {q && <span>para <span className="font-medium text-zinc-900">“{q}”</span></span>}
              {vendedor && (
                <button onClick={() => ir("buscar", { q, cat: filtros.cat })}
                  className="inline-flex items-center gap-1.5 border border-zinc-900 px-2 py-0.5 text-xs">
                  Vendedor: {vendedor} <X size={11} />
                </button>
              )}
            </p>
            <div className="flex items-center gap-2">
              <select value={orden} onChange={(e) => setOrden(e.target.value)}
                className="border border-zinc-300 px-2 py-1.5 text-xs focus:border-zinc-900 focus:outline-none">
                <option value="cierre">Cierran primero</option>
                <option value="pujas">Más pujas</option>
                <option value="barato">Precio más bajo</option>
                <option value="caro">Precio más alto</option>
              </select>
              <div className="flex border border-zinc-300">
                <button onClick={() => setVista("grilla")} className={`p-1.5 ${vista === "grilla" ? "bg-zinc-900 text-white" : "text-zinc-500"}`}><LayoutGrid size={14} /></button>
                <button onClick={() => setVista("lista")} className={`p-1.5 ${vista === "lista" ? "bg-zinc-900 text-white" : "text-zinc-500"}`}><List size={14} /></button>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <Grilla lotes={resultados} now={now} ir={ir} observar={observar} lista={vista === "lista"} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FICHA DEL LOTE
   ============================================================ */
function Ficha({ l, now, ir, observar, pujarUsuario, usuario, lotes, setAuth, avisar }) {
  const r = restante(l.fin, now);
  const minimo = l.pujas.length ? l.precio + incrementoMin(l.precio) : l.precio;
  const [monto, setMonto] = useState(minimo);
  const [tab, setTab] = useState("desc");
  const [foto, setFoto] = useState(0);
  const [panel, setPanel] = useState(null);
  const [preguntas, setPreguntas] = useState(PREGUNTAS_LOTE);
  const [borrador, setBorrador] = useState("");
  const gano = usuario && l.lider === usuario.nombre;
  const conReserva = l.reserva && l.precio < l.reserva;

  useEffect(() => setMonto(minimo), [minimo, l.id]);

  const relacionados = lotes.filter((x) => x.cat === l.cat && x.id !== l.id && now < x.fin).slice(0, 4);

  return (
    <div className="py-6">
      <div className="mb-5 flex items-center gap-1 text-xs text-zinc-500">
        <button onClick={() => ir("home")} className="hover:text-zinc-900">Inicio</button>
        <ChevronRight size={12} />
        <button onClick={() => ir("buscar", { q: "", cat: l.cat })} className="hover:text-zinc-900">
          {CATEGORIAS.find((c) => c.id === l.cat)?.nombre}
        </button>
        <ChevronRight size={12} />
        <span className={`text-zinc-900 ${S.mono}`}>{lote(l.id)}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* imágenes */}
        <div className="lg:col-span-5">
          <div className="flex aspect-square items-center justify-center border border-zinc-200 bg-zinc-50">
            <l.Icon size={110} strokeWidth={0.7} className="text-zinc-300" />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {VISTAS.map((v, i) => (
              <button key={v} onClick={() => setFoto(i)} title={v}
                className={`flex aspect-square flex-col items-center justify-center gap-1 border bg-zinc-50 ${foto === i ? "border-zinc-900" : "border-zinc-200"}`}>
                <l.Icon size={20} strokeWidth={1} className="text-zinc-300" />
                <span className="text-xs text-zinc-400">{v}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">Vista {foto + 1} de {VISTAS.length}: {VISTAS[foto].toLowerCase()}</p>
          <button onClick={() => { setTab("preguntas"); setBorrador("¿Podrías subir más fotos del lote?"); }}
            className="mt-3 flex items-start gap-2 text-left text-xs leading-relaxed text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline">
            <Info size={13} className="mt-0.5 shrink-0" />
            Las fotos son del lote real. Pide fotos adicionales al vendedor antes de pujar.
          </button>
        </div>

        {/* compra */}
        <div className="lg:col-span-7">
          <div className={`flex items-center gap-2 text-xs text-zinc-500 ${S.mono}`}>
            <span>{lote(l.id)}</span><span>·</span><span>{l.cond}</span>
            {l.cantidad > 1 && <><span>·</span><span>{l.cantidad} unidades</span></>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{l.titulo}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              {l.vendedor.tipo === "empresa" ? <Building2 size={14} /> : <User size={14} />}
              <button onClick={() => setTab("vendedor")} className="font-medium hover:underline">{l.vendedor.nombre}</button>
              {l.vendedor.verificado && <BadgeCheck size={14} className="text-zinc-900" />}
            </span>
            <span className={`text-zinc-500 ${S.mono}`}>{l.vendedor.rating}% positivo · {l.vendedor.ventas} ventas</span>
          </div>

          <div className="mt-5 border border-zinc-900">
            {/* estado */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
              <span className={`flex items-center gap-2 text-xs ${r.cerrada ? "text-zinc-500" : r.urgente ? "text-red-600" : "text-zinc-600"}`}>
                <span className={`h-1.5 w-1.5 ${r.cerrada ? "bg-zinc-400" : "animate-pulse bg-red-600"}`} />
                {r.cerrada ? "Subasta cerrada" : "Subasta abierta"}
              </span>
              <span className={`text-sm font-medium ${S.mono} ${r.urgente && !r.cerrada ? "text-red-600" : ""}`}>{r.texto}</span>
            </div>

            <div className="p-4">
              {l.prorrogas > 0 && (
                <div className={`mb-3 flex items-center gap-2 border border-zinc-900 px-3 py-2 text-xs ${S.mono}`}>
                  <Timer size={13} />
                  Prórroga automática ×{l.prorrogas} · toda puja en los últimos 2 minutos extiende el cierre
                </div>
              )}

              {l.tipo !== "compraYa" && (
                <>
                  <p className={S.label}>{r.cerrada ? "Precio final" : "Puja actual"}</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-3">
                    <span className={`text-3xl font-semibold tracking-tight ${S.mono}`}>{clp(l.precio)}</span>
                    <button onClick={() => setTab("pujas")} className={`text-sm text-zinc-500 underline-offset-2 hover:underline ${S.mono}`}>
                      {l.pujas.length} pujas
                    </button>
                    {conReserva && <span className="text-xs text-zinc-500">No alcanza el precio de reserva</span>}
                  </div>

                  {gano && !r.cerrada && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                      <CheckCircle2 size={14} /> Vas ganando este lote
                    </p>
                  )}

                  {!r.cerrada && (
                    <div className="mt-4">
                      <label className={S.label}>Tu puja máxima</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <div className="flex flex-1 items-stretch border border-zinc-300 focus-within:border-zinc-900">
                          <span className="flex items-center px-3 text-sm text-zinc-400">$</span>
                          <input
                            type="number" value={monto} min={minimo}
                            onChange={(e) => setMonto(Number(e.target.value))}
                            className={`w-full py-3 pr-3 text-sm focus:outline-none ${S.mono}`}
                          />
                          <button onClick={() => setMonto(monto + incrementoMin(monto))} className="border-l border-zinc-200 px-3 text-zinc-500 hover:text-zinc-900">
                            <Plus size={14} />
                          </button>
                        </div>
                        <button onClick={() => pujarUsuario(l.id, monto)} className={`${S.btn} px-8`}>
                          <Gavel size={16} /> Pujar
                        </button>
                      </div>
                      <p className={`mt-2 text-xs text-zinc-500 ${S.mono}`}>
                        Mínimo {clp(minimo)} · incremento {clp(incrementoMin(l.precio))}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                        Pujamos por ti de a un incremento hasta tu máximo. Nadie ve ese monto, ni siquiera el vendedor.
                      </p>
                      <button onClick={() => abrir(ir, "comprar/reglas")}
                        className="mt-1 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
                        Si ganas, tienes 48 horas para pagar. Ver qué pasa si no lo haces.
                      </button>
                    </div>
                  )}
                </>
              )}

              {l.compraYa && !r.cerrada && (
                <div className={`mt-5 ${l.tipo !== "compraYa" ? "border-t border-zinc-200 pt-4" : ""}`}>
                  <p className={S.label}>Cómpralo ya</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className={`text-2xl font-medium tracking-tight ${S.mono}`}>{clp(l.compraYa)}</span>
                    <button onClick={() => (usuario ? ir("pagar", { id: l.id }) : setAuth(true))} className={S.btnGhost}>
                      <ShoppingCart size={15} /> Comprar ahora
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-zinc-200 pt-4 text-xs">
                <button onClick={() => observar(l.id)} className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900">
                  <Heart size={14} className={l.observando ? "fill-zinc-900 text-zinc-900" : ""} />
                  {l.observando ? "En observados" : "Observar lote"}
                </button>
                <button onClick={() => setPanel(panel === "compartir" ? null : "compartir")}
                  className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900"><Share2 size={14} /> Compartir</button>
                <button onClick={() => setPanel(panel === "reportar" ? null : "reportar")}
                  className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900"><Flag size={14} /> Reportar</button>
              </div>

              {panel === "compartir" && <PanelCompartir l={l} avisar={avisar} />}
              {panel === "reportar" && <PanelReportar l={l} avisar={avisar} cerrar={() => setPanel(null)} />}
            </div>
          </div>

          {/* pago y envío */}
          <div className="mt-4 grid gap-px bg-zinc-200 sm:grid-cols-2">
            <div className="bg-white p-4">
              <p className={S.label}>Envío y retiro</p>
              <p className="mt-2 flex items-center gap-2 text-sm">
                <Truck size={14} className="text-zinc-400" />
                {l.envio ? <>Despacho {clp(l.envio)} · Chilexpress</> : "Solo retiro en persona"}
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-sm text-zinc-600">
                <MapPin size={14} className="text-zinc-400" /> {l.retiro}, {l.region}
              </p>
            </div>
            <div className="bg-white p-4">
              <p className={S.label}>Formas de pago</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Etiqueta><CreditCard size={12} /> Webpay</Etiqueta>
                <Etiqueta><Wallet size={12} /> Transferencia</Etiqueta>
                {l.crypto && <Etiqueta amber><Bitcoin size={12} /> BTC · USDT · USDC</Etiqueta>}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                El pago se retiene hasta que confirmas la recepción.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 border border-zinc-200 bg-zinc-50 p-4">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-zinc-900" />
            <div>
              <p className="text-sm font-medium">Protección al comprador</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                Si el lote no llega o no corresponde a la publicación, tienes 5 días desde la entrega para abrir un
                reclamo y recuperar tu dinero. Se aplican los derechos de la Ley 19.496.
              </p>
              <button onClick={() => abrir(ir, "comprar/proteccion")} className="mt-2 text-xs font-medium underline underline-offset-2">
                Ver qué cubre
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* pestañas */}
      <div className="mt-12 border-t border-zinc-900">
        <div className="flex gap-6 overflow-x-auto border-b border-zinc-200 rmt-tape">
          {[["desc", "Descripción"], ["specs", "Especificaciones"], ["pujas", `Historial (${l.pujas.length})`], ["preguntas", `Preguntas (${preguntas.length})`], ["vendedor", "Vendedor"], ["envio", "Envío y devoluciones"]].map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm transition ${tab === k ? "border-zinc-900 font-medium text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="py-6">
          {tab === "desc" && (
            <div className="max-w-3xl">
              <p className="text-sm leading-relaxed text-zinc-700">{l.desc}</p>
              <p className="mt-4 text-xs leading-relaxed text-zinc-500">
                Lote vendido en el estado en que se encuentra. Las fallas conocidas están declaradas en esta descripción.
              </p>
            </div>
          )}
          {tab === "specs" && (
            <dl className="max-w-2xl divide-y divide-zinc-200 border-y border-zinc-200">
              {l.specs.map(([k, v]) => (
                <div key={k} className="flex gap-4 py-2.5 text-sm">
                  <dt className="w-48 shrink-0 text-zinc-500">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {tab === "pujas" && (
            <div className="max-w-2xl">
              {l.pujas.length === 0 ? (
                <p className="text-sm text-zinc-500">Todavía no hay pujas. Sé el primero.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b border-zinc-200 text-left ${S.label}`}>
                      <th className="py-2 font-medium">Postor</th>
                      <th className="py-2 font-medium">Monto</th>
                      <th className="py-2 text-right font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {l.pujas.slice(0, 15).map((p, i) => (
                      <tr key={i}>
                        <td className={`py-2.5 ${S.mono}`}>
                          {mask(p.usuario)}
                          {i === 0 && <span className="ml-2 bg-zinc-900 px-1.5 py-0.5 text-xs text-white">Mejor postor</span>}
                        </td>
                        <td className={`py-2.5 font-medium ${S.mono}`}>{clp(p.monto)}</td>
                        <td className={`py-2.5 text-right text-zinc-500 ${S.mono}`}>
                          {new Date(p.fecha).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-4 text-xs text-zinc-500">
                Los nombres se muestran parcialmente para proteger la identidad de los postores.
              </p>
            </div>
          )}
          {tab === "vendedor" && (
            <div className="max-w-2xl">
              <div className="flex items-start gap-4 border border-zinc-200 p-5">
                <div className="flex h-14 w-14 items-center justify-center bg-zinc-100">
                  {l.vendedor.tipo === "empresa" ? <Building2 size={22} /> : <User size={22} />}
                </div>
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {l.vendedor.nombre}
                    {l.vendedor.verificado && <BadgeCheck size={16} />}
                  </p>
                  <p className={`mt-1 text-sm text-zinc-500 ${S.mono}`}>
                    {l.vendedor.rating}% positivo · {l.vendedor.ventas} ventas
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {l.vendedor.tipo === "empresa" ? "Vendedor empresa · identidad tributaria verificada" : "Vendedor particular · identidad verificada"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => ir("buscar", { q: "", cat: "todas", vendedor: l.vendedor.nombre })}
                      className={`${S.btnGhost} px-3 py-1.5 text-xs`}>Ver sus lotes</button>
                    <button onClick={() => setTab("preguntas")} className={`${S.btnGhost} px-3 py-1.5 text-xs`}>Hacer una pregunta</button>
                    <button onClick={() => abrir(ir, "vender/reglas")} className={`${S.btnGhost} px-3 py-1.5 text-xs`}>Reglas que debe cumplir</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab === "preguntas" && (
            <div className="max-w-2xl">
              <ul className="divide-y divide-zinc-200 border-y border-zinc-200">
                {preguntas.map((p, i) => (
                  <li key={i} className="py-4">
                    <p className={`text-xs text-zinc-400 ${S.mono}`}>{mask(p.de)} preguntó</p>
                    <p className="mt-1 text-sm">{p.q}</p>
                    {p.r ? (
                      <div className="mt-2 border-l-2 border-zinc-200 pl-3">
                        <p className={`text-xs text-zinc-400 ${S.mono}`}>{l.vendedor.nombre} respondió</p>
                        <p className="mt-0.5 text-sm text-zinc-700">{p.r}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">Sin responder todavía.</p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <label className={`${S.label} mb-2 block`}>Tu pregunta</label>
                <textarea rows={3} value={borrador} onChange={(e) => setBorrador(e.target.value)}
                  placeholder="Pregunta por el estado, el retiro o las fallas. Las respuestas quedan visibles para todos."
                  className={S.input} />
                <button
                  onClick={() => {
                    if (!usuario) { setAuth(true); return; }
                    if (!borrador.trim()) { avisar("Escribe tu pregunta antes de enviarla.", "error"); return; }
                    setPreguntas((p) => [...p, { de: usuario.nombre, q: borrador.trim(), r: null }]);
                    setBorrador("");
                    avisar("Pregunta enviada. El vendedor tiene 24 horas para responder.", "ok");
                  }}
                  className={`${S.btn} mt-3`}>Enviar pregunta</button>
                <p className="mt-2 text-xs text-zinc-500">
                  No compartas teléfono ni correo acá: cerrar la venta por fuera deja la operación sin custodia.
                </p>
              </div>
            </div>
          )}
          {tab === "envio" && (
            <div className="max-w-2xl space-y-4 text-sm text-zinc-700">
              <div>
                <p className="font-medium">Plazo de despacho</p>
                <p className="mt-1 text-zinc-600">El vendedor despacha dentro de 3 días hábiles desde el pago confirmado.</p>
              </div>
              <div>
                <p className="font-medium">Devoluciones</p>
                <p className="mt-1 text-zinc-600">
                  {l.vendedor.tipo === "empresa"
                    ? "10 días para devolver si el lote no corresponde a lo publicado. El costo de despacho de la devolución lo asume el vendedor."
                    : "Venta entre particulares: se acepta devolución solo si el lote no corresponde a la descripción."}
                </p>
              </div>
              <div>
                <p className="font-medium">Retiro en persona</p>
                <p className="mt-1 text-zinc-600">Disponible en {l.retiro}, coordinando con el vendedor dentro de 5 días hábiles.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {relacionados.length > 0 && (
        <Seccion titulo="Lotes parecidos" sub={`Abiertos en ${CATEGORIAS.find((c) => c.id === l.cat)?.nombre}`}>
          <Grilla lotes={relacionados} now={now} ir={ir} observar={observar} />
        </Seccion>
      )}
    </div>
  );
}

const VISTAS = ["Frontal", "Detalle", "Trasera", "Marcas de uso"];

const PREGUNTAS_LOTE = [
  { de: "mtapia", q: "¿Se puede retirar el sábado por la mañana?", r: "Los retiros son de lunes a viernes de 10:00 a 17:00. Fuera de ese horario hay que coordinar por interno." },
  { de: "sgonzalez", q: "¿Tiene factura o boleta de compra original?", r: "Es un equipo dado de baja de una empresa, se entrega con acta de baja. Nosotros emitimos boleta por la venta." },
  { de: "kmuñoz", q: "¿La batería se puede reemplazar sin abrir todo el equipo?", r: null },
];

const MOTIVOS_REPORTE = [
  "Las fotos no son del lote real",
  "La descripción no corresponde al producto",
  "Producto prohibido o falsificado",
  "El vendedor pide cerrar el trato por fuera",
  "Sospecho que el vendedor puja en su propio lote",
  "El precio o la categoría son engañosos",
];

function PanelCompartir({ l, avisar }) {
  const enlace = "https://rematoonline.cl/lote/" + String(l.id).padStart(4, "0");
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="rmt-in mt-4 border-t border-zinc-200 pt-4">
      <p className={S.label}>Compartir este lote</p>
      <div className="mt-2 flex gap-2">
        <input readOnly value={enlace} onFocus={(e) => e.target.select()} className={`${S.input} ${S.mono}`} />
        <button
          onClick={() => {
            try { navigator.clipboard && navigator.clipboard.writeText(enlace); } catch (e) { /* copia manual */ }
            setCopiado(true); avisar("Enlace copiado.", "ok"); setTimeout(() => setCopiado(false), 2500);
          }}
          className={`${S.btn} shrink-0`}>{copiado ? <Check size={15} /> : <Share2 size={15} />} Copiar</button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Compartir lotes es gratis y ayuda al vendedor a llegar a más postores sin pagar publicidad.
      </p>
    </div>
  );
}

function PanelReportar({ l, avisar, cerrar }) {
  const [motivo, setMotivo] = useState(MOTIVOS_REPORTE[0]);
  const [detalle, setDetalle] = useState("");
  return (
    <div className="rmt-in mt-4 border-t border-zinc-200 pt-4">
      <p className={S.label}>Reportar {lote(l.id)}</p>
      <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={`${S.input} mt-2`}>
        {MOTIVOS_REPORTE.map((m) => <option key={m}>{m}</option>)}
      </select>
      <textarea rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)}
        placeholder="Cuéntanos qué viste. Si tienes capturas, adjúntalas después por correo." className={`${S.input} mt-2`} />
      <div className="mt-2 flex gap-2">
        <button onClick={() => { avisar("Reporte enviado. Revisamos el lote en 24 horas.", "ok"); cerrar(); }} className={S.btn}>
          <Flag size={15} /> Enviar reporte
        </button>
        <button onClick={cerrar} className={S.btnGhost}>Cancelar</button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Los reportes son anónimos para el vendedor. Reportar en falso de forma repetida también se sanciona.
      </p>
    </div>
  );
}

function Etiqueta({ children, amber }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-1 text-xs ${amber ? "border-amber-300 bg-amber-50 text-amber-700" : "border-zinc-200 bg-zinc-50 text-zinc-700"} ${S.mono}`}>
      {children}
    </span>
  );
}

/* ============================================================
   PAGO CON CUSTODIA (ESCROW)
   ============================================================ */
function Pagar({ l, ir, usuario, avisar, now }) {
  const [medio, setMedio] = useState("webpay");
  const [moneda, setMoneda] = useState("USDT");
  const [paso, setPaso] = useState(1);
  const [editandoDir, setEditandoDir] = useState(false);
  const [dir, setDir] = useState("Av. Providencia 1234, dpto 802");
  const [comuna, setComuna] = useState("Providencia");

  const precio = l.compraYa || l.precio;
  const total = precio + l.envio;
  const monto = (total / TASAS[moneda]).toFixed(moneda === "BTC" ? 6 : 2);
  const necesitaKyc = medio === "crypto" && total > UMBRAL_KYC && usuario?.kyc !== "verificado";

  const pasos = [
    ["Pago recibido", "Tu dinero queda retenido por RematoOnline"],
    ["Vendedor notificado", "Tiene 3 días hábiles para despachar"],
    ["En camino", "Recibes el número de seguimiento"],
    ["Confirmas recepción", "Tienes 5 días para revisar el lote"],
    ["Fondos liberados", "El vendedor recibe el pago"],
  ];

  return (
    <div className="mx-auto max-w-4xl py-8">
      <button onClick={() => ir("lote", { id: l.id })} className="mb-6 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
        <ArrowLeft size={13} /> Volver al lote
      </button>

      {paso === 1 ? (
        <div className="grid gap-8 md:grid-cols-5">
          <div className="md:col-span-3">
            <h1 className="text-2xl font-semibold tracking-tight">Pagar el lote</h1>
            <p className="mt-1 text-sm text-zinc-600">Tu pago queda retenido hasta que confirmes que recibiste el lote.</p>

            <div className="mt-6 space-y-px bg-zinc-200">
              {[
                { id: "webpay", t: "Webpay Plus", d: "Crédito, débito y prepago", Icon: CreditCard },
                { id: "transferencia", t: "Transferencia bancaria", d: "Acreditación en el día vía Flow", Icon: Wallet },
                { id: "crypto", t: "Criptomonedas", d: "BTC, USDT o USDC · conversión a pesos al confirmar", Icon: Bitcoin, off: !l.crypto },
              ].map((m) => (
                <button key={m.id} disabled={m.off} onClick={() => setMedio(m.id)}
                  className={`flex w-full items-center gap-3 bg-white p-4 text-left transition disabled:opacity-40 ${medio === m.id ? "ring-1 ring-inset ring-zinc-900" : "hover:bg-zinc-50"}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${medio === m.id ? "border-zinc-900" : "border-zinc-300"}`}>
                    {medio === m.id && <span className="h-2 w-2 rounded-full bg-zinc-900" />}
                  </span>
                  <m.Icon size={18} className="text-zinc-500" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{m.t}</span>
                    <span className="block text-xs text-zinc-500">{m.off ? "No disponible en este lote" : m.d}</span>
                  </span>
                </button>
              ))}
            </div>

            {medio === "crypto" && (
              <div className="mt-4 border border-zinc-200 p-4">
                <p className={S.label}>Moneda</p>
                <div className="mt-2 flex gap-2">
                  {Object.keys(TASAS).map((c) => (
                    <button key={c} onClick={() => setMoneda(c)}
                      className={`border px-3 py-1.5 text-xs ${S.mono} ${moneda === c ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-600"}`}>
                      {c}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-4 border-t border-zinc-200 pt-4">
                  <QR />
                  <div className="min-w-0">
                    <p className={`text-lg font-medium ${S.mono}`}>{monto} {moneda}</p>
                    <p className={`mt-1 text-xs text-zinc-500 ${S.mono}`}>1 {moneda} = {clp(TASAS[moneda])} · tasa referencial</p>
                    <p className={`mt-2 truncate text-xs text-zinc-500 ${S.mono}`}>bc1q7x…4f2p9k</p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      La tasa se congela 15 minutos. El monto en pesos que recibe el vendedor no cambia.
                    </p>
                  </div>
                </div>
                {necesitaKyc && (
                  <div className="mt-4 flex items-start gap-3 border border-amber-300 bg-amber-50 p-3">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Verifica tu identidad para continuar</p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-700">
                        Los pagos en cripto sobre {clp(UMBRAL_KYC)} requieren verificación de identidad antes de procesarse.
                        Toma unos minutos: cédula por ambos lados y una selfie.
                      </p>
                      <button onClick={() => ir("cuenta")} className="mt-2 text-xs font-medium text-amber-800 underline">Verificar ahora</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6">
              <p className={S.label}>Entrega</p>
              <div className="mt-2 border border-zinc-200 p-4 text-sm">
                {editandoDir ? (
                  <div className="space-y-2">
                    <input value={dir} onChange={(e) => setDir(e.target.value)} className={S.input} />
                    <select value={comuna} onChange={(e) => setComuna(e.target.value)} className={S.input}>
                      {COMUNAS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditandoDir(false); avisar("Dirección actualizada.", "ok"); }} className={`${S.btn} px-4 py-2`}>Guardar</button>
                      <button onClick={() => setEditandoDir(false)} className={`${S.btnGhost} px-4 py-2`}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-medium">{usuario?.nombre || "Invitado"}</p>
                    <p className="mt-1 text-zinc-600">{dir} · {comuna}</p>
                    <button onClick={() => setEditandoDir(true)} className="mt-2 text-xs text-zinc-500 underline">Cambiar dirección</button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="border border-zinc-900">
              <div className="border-b border-zinc-200 px-4 py-2.5"><p className={S.label}>Resumen</p></div>
              <div className="space-y-2 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-zinc-50"><l.Icon size={20} strokeWidth={1} className="text-zinc-300" /></div>
                  <div className="min-w-0">
                    <p className="text-xs leading-snug">{l.titulo}</p>
                    <p className={`mt-0.5 text-xs text-zinc-400 ${S.mono}`}>{lote(l.id)}</p>
                  </div>
                </div>
                <div className="space-y-1.5 border-t border-zinc-200 pt-3">
                  <Linea k="Lote" v={clp(precio)} />
                  <Linea k="Despacho" v={l.envio ? clp(l.envio) : "Retiro"} />
                  <Linea k="Comisión de compra" v="$0" />
                </div>
                <div className="flex items-baseline justify-between border-t border-zinc-200 pt-3">
                  <span className="font-medium">Total</span>
                  <span className={`text-xl font-semibold ${S.mono}`}>{clp(total)}</span>
                </div>
                <button disabled={necesitaKyc} onClick={() => { setPaso(2); avisar("Pago retenido en custodia.", "ok"); }}
                  className={`${S.btn} mt-3 w-full`}>
                  <Lock size={15} /> Pagar {clp(total)}
                </button>
                <p className="mt-2 text-center text-xs text-zinc-500">
                  El vendedor recibe el dinero recién cuando confirmes la recepción.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-xl">
          <div className="flex items-center gap-3 border border-zinc-900 p-5">
            <CheckCircle2 size={22} className="text-emerald-600" />
            <div>
              <p className="font-medium">Pago retenido</p>
              <p className={`text-sm text-zinc-600 ${S.mono}`}>{clp(total)} · {lote(l.id)}</p>
            </div>
          </div>
          <ol className="mt-6 border-l border-zinc-200 pl-6">
            {pasos.map((p, i) => (
              <li key={p[0]} className="relative pb-6 last:pb-0">
                <span className={`absolute -left-7 top-1 h-2 w-2 ${i === 0 ? "bg-zinc-900" : "border border-zinc-300 bg-white"}`} />
                <p className={`text-sm ${i === 0 ? "font-medium" : "text-zinc-500"}`}>{p[0]}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{p[1]}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex gap-2">
            <button onClick={() => ir("cuenta")} className={S.btn}>Ver mis compras</button>
            <button onClick={() => ir("home")} className={S.btnGhost}>Seguir mirando lotes</button>
          </div>
        </div>
      )}
    </div>
  );
}

const Linea = ({ k, v }) => (
  <div className="flex justify-between text-sm">
    <span className="text-zinc-600">{k}</span>
    <span className={S.mono}>{v}</span>
  </div>
);

function QR() {
  const celdas = useMemo(() => Array.from({ length: 144 }, (_, i) => ((i * 37 + (i % 7) * 11) % 5 < 2)), []);
  return (
    <div className="grid shrink-0 grid-cols-12 gap-px border border-zinc-200 bg-white p-2">
      {celdas.map((on, i) => <span key={i} className={`h-1.5 w-1.5 ${on ? "bg-zinc-900" : "bg-white"}`} />)}
    </div>
  );
}

/* ============================================================
   PUBLICAR
   ============================================================ */
function Vender({ publicar, usuario, setAuth, ir }) {
  const [paso, setPaso] = useState(1);
  const [f, setF] = useState({
    titulo: "", cat: "tecnologia", cond: "Usado", tipo: "ambos",
    inicial: 50000, compraYa: 150000, dias: 7, reserva: "",
    region: "Región Metropolitana", retiro: "Santiago Centro", envio: 4990,
    crypto: true, desc: "", cantidad: 1, fotos: 0, fallas: false,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const q = calidad({ titulo: f.titulo, fotos: f.fotos, desc: f.desc, fallas: f.fallas });

  const estimado = f.tipo === "compraYa" ? Number(f.compraYa) : Number(f.inicial) * 2.4;
  const comision = comisionDe(estimado, f.cat);
  const iva = comision * 0.19;
  const recibe = estimado - comision - iva;

  const pasos = ["Qué vendes", "Formato y precio", "Entrega y pago", "Revisar"];

  const enviar = () => {
    if (!usuario) { setAuth(true); return; }
    const cat = CATEGORIAS.find((c) => c.id === f.cat);
    publicar({
      titulo: f.titulo || "Lote sin título",
      cat: f.cat, cond: f.cond, tipo: f.tipo,
      inicial: Number(f.inicial),
      compraYa: f.tipo === "subasta" ? null : Number(f.compraYa),
      reserva: f.reserva ? Number(f.reserva) : null,
      fin: Date.now() + Number(f.dias) * DAY,
      Icon: cat.Icon, crypto: f.crypto, cantidad: Number(f.cantidad),
      vendedor: { nombre: usuario.nombre, rating: 100, ventas: 0, tipo: "particular", verificado: false },
      region: f.region, envio: Number(f.envio), retiro: f.retiro,
      desc: f.desc || "Sin descripción adicional.",
      specs: [["Estado", f.cond], ["Unidades", String(f.cantidad)], ["Ubicación", f.region], ["Fotos", String(f.fotos)]],
    });
  };

  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Publicar un lote</h1>
      <p className="mt-1 text-sm text-zinc-600">Toma menos de 3 minutos. Publicar es gratis: solo cobramos si vendes.</p>
      <button onClick={() => abrir(ir, "vender/reglas")} className="mt-2 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
        Ver qué se puede publicar y qué no
      </button>

      <ol className="mt-8 flex gap-px bg-zinc-200 text-xs">
        {pasos.map((p, i) => (
          <li key={p} className={`flex-1 bg-white px-3 py-2.5 ${paso === i + 1 ? "border-b-2 border-zinc-900 font-medium" : "text-zinc-400"}`}>
            <span className={S.mono}>{String(i + 1).padStart(2, "0")}</span> {p}
          </li>
        ))}
      </ol>

      <div className="mt-8 space-y-5">
        {paso === 1 && (
          <>
            <Campo label="Título del lote">
              <input value={f.titulo} onChange={(e) => set("titulo", e.target.value)}
                placeholder="Ej: Lote 12 notebooks Dell Latitude 5400 · i5 8GB" className={S.input} />
              <p className="mt-1 text-xs text-zinc-500">Parte por marca y modelo. Es lo que la gente busca.</p>
            </Campo>
            <div className="grid gap-5 sm:grid-cols-3">
              <Campo label="Categoría">
                <select value={f.cat} onChange={(e) => set("cat", e.target.value)} className={S.input}>
                  {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Estado">
                <select value={f.cond} onChange={(e) => set("cond", e.target.value)} className={S.input}>
                  {["Nuevo", "Usado", "Reacondicionado"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Campo>
              <Campo label="Unidades">
                <input type="number" min="1" value={f.cantidad} onChange={(e) => set("cantidad", e.target.value)} className={`${S.input} ${S.mono}`} />
              </Campo>
            </div>
            <Campo label="Descripción">
              <textarea rows={5} value={f.desc} onChange={(e) => set("desc", e.target.value)}
                placeholder="Declara las fallas conocidas. Los lotes con fallas declaradas reciben menos reclamos y mejores pujas."
                className={S.input} />
            </Campo>
            <Campo label={`Fotos del lote real · ${f.fotos} de 3 mínimo`}>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7].slice(0, Math.max(4, f.fotos + 1)).map((i) => (
                  i < f.fotos ? (
                    <div key={i} className="relative flex aspect-square items-center justify-center border border-zinc-200 bg-zinc-50">
                      <Package size={18} strokeWidth={1} className="text-zinc-300" />
                      <span className={`absolute bottom-1 left-1 text-xs text-zinc-400 ${S.mono}`}>{i === 0 ? "Principal" : String(i + 1).padStart(2, "0")}</span>
                      <button onClick={() => set("fotos", f.fotos - 1)} aria-label="Quitar foto"
                        className="absolute right-1 top-1 border border-zinc-200 bg-white p-0.5 text-zinc-400 hover:text-zinc-900"><X size={11} /></button>
                    </div>
                  ) : (
                    <button key={i} onClick={() => set("fotos", f.fotos + 1)}
                      className="flex aspect-square flex-col items-center justify-center gap-1 border border-dashed border-zinc-300 text-zinc-400 transition hover:border-zinc-900 hover:text-zinc-900">
                      <Upload size={16} /><span className="text-xs">Subir</span>
                    </button>
                  )
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Tienen que ser tuyas. Las fotos del catálogo del fabricante hacen que bajemos el lote.
              </p>
            </Campo>
            <Campo label="Fallas conocidas">
              <button onClick={() => set("fallas", !f.fallas)}
                className={`flex w-full items-start gap-3 border px-3 py-3 text-left ${f.fallas ? "border-zinc-900" : "border-zinc-300"}`}>
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${f.fallas ? "border-zinc-900 bg-zinc-900" : "border-zinc-300"}`}>
                  {f.fallas && <Check size={11} className="text-white" />}
                </span>
                <span>
                  <span className="block text-sm">Declaro las fallas conocidas del lote en la descripción</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Una falla declarada no da derecho a reclamo. Una falla escondida sí, y la pagas tú.
                  </span>
                </span>
              </button>
            </Campo>
            <Medidor q={q} />
          </>
        )}

        {paso === 2 && (
          <>
            <Campo label="Formato de venta">
              <div className="grid gap-px bg-zinc-200 sm:grid-cols-3">
                {[["subasta", "Solo subasta", "El precio lo fija el mercado"],
                  ["ambos", "Subasta + Cómpralo ya", "Quien quiera cerrar rápido, paga el fijo"],
                  ["compraYa", "Solo precio fijo", "Sin pujas, venta directa"]].map(([v, t, d]) => (
                  <button key={v} onClick={() => set("tipo", v)}
                    className={`bg-white p-3 text-left ${f.tipo === v ? "ring-1 ring-inset ring-zinc-900" : "hover:bg-zinc-50"}`}>
                    <p className="text-sm font-medium">{t}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{d}</p>
                  </button>
                ))}
              </div>
            </Campo>
            <div className="grid gap-5 sm:grid-cols-2">
              {f.tipo !== "compraYa" && (
                <Campo label="Puja inicial">
                  <input type="number" value={f.inicial} onChange={(e) => set("inicial", e.target.value)} className={`${S.input} ${S.mono}`} />
                  <p className="mt-1 text-xs text-zinc-500">Partir bajo atrae más postores. El incremento actual sería {clp(incrementoMin(Number(f.inicial)))}.</p>
                </Campo>
              )}
              {f.tipo !== "subasta" && (
                <Campo label="Precio Cómpralo ya">
                  <input type="number" value={f.compraYa} onChange={(e) => set("compraYa", e.target.value)} className={`${S.input} ${S.mono}`} />
                </Campo>
              )}
              {f.tipo !== "compraYa" && (
                <>
                  <Campo label="Precio de reserva (opcional)">
                    <input type="number" value={f.reserva} onChange={(e) => set("reserva", e.target.value)}
                      placeholder="Sin reserva" className={`${S.input} ${S.mono}`} />
                    <p className="mt-1 text-xs text-zinc-500">Bajo este monto no estás obligado a vender.</p>
                  </Campo>
                  <Campo label="Duración">
                    <select value={f.dias} onChange={(e) => set("dias", e.target.value)} className={S.input}>
                      {[1, 3, 5, 7, 10].map((d) => <option key={d} value={d}>{d} días</option>)}
                    </select>
                  </Campo>
                </>
              )}
            </div>
            <div className="flex items-start gap-3 border border-zinc-200 bg-zinc-50 p-4">
              <Timer size={16} className="mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed text-zinc-600">
                Toda puja en los últimos 2 minutos extiende el cierre otros 2 minutos. Nadie gana tu lote por
                pujar un segundo antes del final.
              </p>
            </div>
          </>
        )}

        {paso === 3 && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo label="Región">
                <select value={f.region} onChange={(e) => set("region", e.target.value)} className={S.input}>
                  {REGIONES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Campo>
              <Campo label="Comuna de retiro">
                <input value={f.retiro} onChange={(e) => set("retiro", e.target.value)} className={S.input} />
              </Campo>
              <Campo label="Costo de despacho">
                <input type="number" value={f.envio} onChange={(e) => set("envio", e.target.value)} className={`${S.input} ${S.mono}`} />
                <p className="mt-1 text-xs text-zinc-500">Deja 0 si el lote es solo retiro en persona.</p>
              </Campo>
            </div>
            <Campo label="Formas de pago">
              <div className="space-y-2">
                <div className="flex items-center gap-2 border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
                  <Check size={14} /> Webpay y transferencia · siempre activos
                </div>
                <button onClick={() => set("crypto", !f.crypto)}
                  className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left ${f.crypto ? "border-zinc-900" : "border-zinc-300"}`}>
                  <span className={`flex h-4 w-4 items-center justify-center border ${f.crypto ? "border-zinc-900 bg-zinc-900" : "border-zinc-300"}`}>
                    {f.crypto && <Check size={11} className="text-white" />}
                  </span>
                  <Bitcoin size={16} className="text-amber-600" />
                  <span>
                    <span className="block text-sm">Aceptar cripto (BTC, USDT, USDC)</span>
                    <span className="block text-xs text-zinc-500">Recibes pesos igual. La conversión la hace la pasarela, no tú.</span>
                  </span>
                </button>
              </div>
            </Campo>
          </>
        )}

        {paso === 4 && (
          <>
            <div className="border border-zinc-900">
              <div className="border-b border-zinc-200 px-4 py-2.5"><p className={S.label}>Tu lote</p></div>
              <dl className="divide-y divide-zinc-100 p-4 text-sm">
                {[["Título", f.titulo || "—"],
                  ["Categoría", CATEGORIAS.find((c) => c.id === f.cat)?.nombre],
                  ["Estado", f.cond],
                  ["Formato", f.tipo === "subasta" ? "Solo subasta" : f.tipo === "ambos" ? "Subasta + Cómpralo ya" : "Precio fijo"],
                  ["Precio de partida", f.tipo === "compraYa" ? clp(f.compraYa) : clp(f.inicial)],
                  ["Duración", f.tipo === "compraYa" ? "30 días" : `${f.dias} días`],
                  ["Ubicación", `${f.retiro}, ${f.region}`],
                  ["Fotos", `${f.fotos} cargadas`],
                  ["Calidad de la publicación", `${q.total}/100 · ${q.nivel}`],
                  ["Cripto", f.crypto ? "Sí" : "No"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2">
                    <dt className="text-zinc-500">{k}</dt><dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="border border-zinc-200">
              <div className="border-b border-zinc-200 px-4 py-2.5"><p className={S.label}>Cuánto recibes</p></div>
              <div className="space-y-2 p-4">
                <Linea k="Precio estimado de venta" v={clp(estimado)} />
                <Linea k={`Comisión RematoOnline (${Math.round((COMISIONES[f.cat] ?? 0.08) * 100)}%)`} v={"− " + clp(comision)} />
                <Linea k="IVA sobre la comisión (19%)" v={"− " + clp(iva)} />
                <div className="flex justify-between border-t border-zinc-200 pt-3">
                  <span className="text-sm font-medium">Depositamos a tu cuenta</span>
                  <span className={`text-lg font-semibold ${S.mono}`}>{clp(recibe)}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  La comisión es por el servicio de intermediación y lleva IVA (Ley 21.420). El bien que vendes,
                  si eres particular, no lo lleva. Transferimos a los 2 días hábiles desde que el comprador confirma.
                </p>
                <button onClick={() => abrir(ir, "vender/comisiones")} className="mt-1 text-xs font-medium underline underline-offset-2">
                  Ver todas las comisiones
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-5">
        <button onClick={() => setPaso(Math.max(1, paso - 1))} disabled={paso === 1}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-30">
          <ArrowLeft size={14} /> Atrás
        </button>
        {paso < 4 ? (
          <button disabled={paso === 1 && !q.publicable} onClick={() => setPaso(paso + 1)} className={S.btn}>
            {paso === 1 && !q.publicable ? "Faltan los mínimos" : "Continuar"} <ArrowRight size={15} />
          </button>
        ) : (
          <button onClick={enviar} className={S.btn}><Gavel size={15} /> Publicar lote</button>
        )}
      </div>
    </div>
  );
}

const Campo = ({ label, children }) => (
  <div>
    <label className={`${S.label} mb-2 block`}>{label}</label>
    {children}
  </div>
);

/* ============================================================
   CUENTA
   ============================================================ */
function Cuenta({ usuario, misPujas, observados, lotes, now, ir, observar, setAuth, setUsuario, avisar }) {
  const [tab, setTab] = useState("pujas");
  if (!usuario)
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Ingresa a tu cuenta</h1>
        <p className="mt-2 text-sm text-zinc-600">Para pujar, observar lotes y vender necesitas una cuenta.</p>
        <button onClick={() => setAuth(true)} className={`${S.btn} mt-5`}>Ingresar</button>
      </div>
    );

  const ganando = misPujas.filter((l) => l.lider === usuario.nombre && now < l.fin);
  const superadas = misPujas.filter((l) => l.lider !== usuario.nombre && now < l.fin);
  const ganadas = misPujas.filter((l) => l.lider === usuario.nombre && now >= l.fin);
  const mios = lotes.filter((l) => l.vendedor.nombre === usuario.nombre);

  const tabs = [
    ["pujas", `Mis pujas (${misPujas.length})`],
    ["observados", `Observados (${observados.length})`],
    ["ventas", `Mis ventas (${mios.length})`],
    ["comprador", "Como comprador"],
    ["vendedor", "Como vendedor"],
    ["cuenta", "Verificación"],
  ];

  return (
    <div className="py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <p className={S.label}>Tu cuenta</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{usuario.nombre}</h1>
        </div>
        <div className="flex gap-8 text-right">
          {[["Ganando", ganando.length], ["Superadas", superadas.length], ["Ganadas", ganadas.length]].map(([k, v]) => (
            <div key={k}>
              <div className={`text-2xl font-medium ${S.mono} ${k === "Ganando" ? "text-emerald-600" : k === "Superadas" ? "text-red-600" : ""}`}>{v}</div>
              <div className="text-xs uppercase tracking-widest text-zinc-500">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto border-b border-zinc-200 rmt-tape">
        {tabs.map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm ${tab === k ? "border-zinc-900 font-medium" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="py-6">
        {tab === "pujas" && (
          misPujas.length === 0 ? (
            <Vacio texto="Todavía no pujas por nada." accion="Ver lotes abiertos" onClick={() => ir("buscar", { q: "", cat: "todas" })} />
          ) : (
            <div className="space-y-8">
              {[["Vas ganando", ganando, "text-emerald-600"], ["Te superaron", superadas, "text-red-600"], ["Cerradas", ganadas, "text-zinc-500"]].map(([t, arr, color]) =>
                arr.length > 0 && (
                  <div key={t}>
                    <p className={`${S.label} ${color} mb-2`}>{t} · {arr.length}</p>
                    <Grilla lotes={arr} now={now} ir={ir} observar={observar} lista />
                  </div>
                )
              )}
            </div>
          )
        )}

        {tab === "observados" && (
          observados.length === 0
            ? <Vacio texto="No estás observando ningún lote." accion="Buscar lotes" onClick={() => ir("buscar", { q: "", cat: "todas" })} />
            : <Grilla lotes={observados} now={now} ir={ir} observar={observar} lista />
        )}

        {tab === "ventas" && (
          mios.length === 0
            ? <Vacio texto="No has publicado lotes." accion="Publicar un lote" onClick={() => ir("vender")} />
            : <Grilla lotes={mios} now={now} ir={ir} observar={observar} lista />
        )}

        {tab === "comprador" && (
          <div className="max-w-3xl space-y-5">
            <div className="grid gap-px bg-zinc-200 sm:grid-cols-4">
              {[["Lotes ganados", ganadas.length], ["Pagados a tiempo", ganadas.length], ["Faltas", 0], ["Multas pendientes", clp(0)]].map(([k, v]) => (
                <div key={k} className="bg-white p-4">
                  <p className={`text-xl font-medium ${S.mono}`}>{v}</p>
                  <p className="mt-1 text-xs text-zinc-500">{k}</p>
                </div>
              ))}
            </div>
            <div className="border border-zinc-200 p-5">
              <p className="font-medium">Cuánto puedes pujar</p>
              <p className="mt-1 text-sm text-zinc-600">
                El tope sube según lo que tengas verificado. {usuario.kyc === "verificado"
                  ? `Con identidad verificada puedes pujar hasta ${clp(2000000)} sin garantía retenida.`
                  : `Con solo el correo confirmado tu tope es ${clp(200000)}.`}
              </p>
              <ul className="mt-3 divide-y divide-zinc-100 border-y border-zinc-100">
                {NIVELES_PUJA.map(([nivel, tope, req], i) => {
                  const activo = usuario.kyc === "verificado" ? i <= 1 : i === 0;
                  return (
                    <li key={nivel} className="flex items-start gap-3 py-2.5">
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${activo ? "border-zinc-900 bg-zinc-900" : "border-zinc-300"}`}>
                        {activo && <Check size={11} className="text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{nivel}</span>
                        <span className="block text-xs text-zinc-500">{req}</span>
                      </span>
                      <span className={`shrink-0 text-xs ${S.mono} ${activo ? "" : "text-zinc-400"}`}>{tope}</span>
                    </li>
                  );
                })}
              </ul>
              {usuario.kyc !== "verificado" && (
                <button onClick={() => setTab("cuenta")} className={`${S.btn} mt-4`}>Subir mi tope</button>
              )}
            </div>
            <div className="border border-zinc-200 p-5">
              <p className="font-medium">Si ganas y no pagas</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                A las 48 horas el lote pasa al segundo postor y se te cobra una multa por el tiempo que el lote
                estuvo bloqueado y por lo que el vendedor ya había gastado. La primera falta son 7 días sin pujar.
              </p>
              <button onClick={() => abrir(ir, "comprar/reglas")} className={`${S.btnGhost} mt-3`}>Ver las reglas y calcular la multa</button>
            </div>
          </div>
        )}

        {tab === "vendedor" && (
          <div className="max-w-3xl space-y-5">
            <div className="grid gap-px bg-zinc-200 sm:grid-cols-4">
              {[["Lotes publicados", mios.length], ["Despacho a tiempo", "—"], ["Reclamos", "0%"], ["Calificación", "100%"]].map(([k, v]) => (
                <div key={k} className="bg-white p-4">
                  <p className={`text-xl font-medium ${S.mono}`}>{v}</p>
                  <p className="mt-1 text-xs text-zinc-500">{k}</p>
                </div>
              ))}
            </div>
            <div className="border border-zinc-200 p-5">
              <p className="font-medium">Tus límites hoy</p>
              <p className="mt-1 text-sm text-zinc-600">
                Cuenta {mios.length ? "con lotes publicados" : "nueva"} sin ventas calificadas: hasta 3 lotes
                abiertos y {clp(500000)} por lote. Se amplía con la primera venta sin reclamos.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => ir("vender")} className={S.btn}>Publicar un lote</button>
                <button onClick={() => abrir(ir, "vender/reglas")} className={S.btnGhost}>Reglas del vendedor</button>
                <button onClick={() => abrir(ir, "vender/difundir")} className={S.btnGhost}>Difundir gratis</button>
              </div>
            </div>
            <div className="border border-zinc-200 p-5">
              <p className="font-medium">Cuenta bancaria para cobrar</p>
              <p className="mt-1 text-sm text-zinc-600">
                {usuario.kyc === "verificado" ? "Verificada y lista para recibir depósitos." : "Necesitas verificar identidad antes de recibir pagos."}
              </p>
              {usuario.kyc !== "verificado" && (
                <button onClick={() => setTab("cuenta")} className={`${S.btnGhost} mt-3`}>Verificar identidad</button>
              )}
            </div>
          </div>
        )}

        {tab === "cuenta" && (
          <div className="max-w-2xl space-y-4">
            <div className="border border-zinc-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">Verificación de identidad</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Necesaria para vender y para pagar con cripto sobre {clp(UMBRAL_KYC)}.
                  </p>
                </div>
                <span className={`shrink-0 border px-2 py-1 text-xs ${S.mono} ${usuario.kyc === "verificado" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-zinc-300 text-zinc-600"}`}>
                  {usuario.kyc}
                </span>
              </div>
              {usuario.kyc !== "verificado" && (
                <div className="mt-4 space-y-2">
                  {["Cédula de identidad por ambos lados", "Selfie sosteniendo la cédula", "Cuenta bancaria a tu nombre"].map((x) => (
                    <div key={x} className="flex items-center gap-2 border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600">
                      <FileText size={14} className="text-zinc-400" /> {x}
                    </div>
                  ))}
                  <button
                    onClick={() => { setUsuario((u) => ({ ...u, kyc: "verificado" })); avisar("Identidad verificada.", "ok"); }}
                    className={`${S.btn} mt-2`}>
                    <ShieldCheck size={15} /> Enviar documentos
                  </button>
                </div>
              )}
            </div>
            <div className="border border-zinc-200 p-5 text-sm">
              <p className="font-medium">Datos de la cuenta</p>
              <dl className="mt-3 divide-y divide-zinc-100">
                {[["Usuario", usuario.nombre], ["Miembro desde", usuario.desde], ["Notificaciones de puja superada", "Activadas"]].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2">
                    <dt className="text-zinc-500">{k}</dt><dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Vacio = ({ texto, accion, onClick }) => (
  <div className="border border-dashed border-zinc-300 px-6 py-16 text-center">
    <p className="text-sm font-medium">{texto}</p>
    <button onClick={onClick} className={`${S.btnGhost} mt-4`}>{accion}</button>
  </div>
);

/* ============================================================
   ENTRAR
   ============================================================ */
function Entrar({ entrar, cerrar }) {
  const [nombre, setNombre] = useState("");
  const [olvide, setOlvide] = useState(false);
  const [clave, setClave] = useState("demo1234");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900 bg-opacity-40 p-4 sm:items-center">
      <div className="rmt-in w-full max-w-sm border border-zinc-900 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <span className="text-sm font-medium">Ingresar a RematoOnline</span>
          <button onClick={cerrar} className="text-zinc-400 hover:text-zinc-900"><X size={16} /></button>
        </div>
        <div className="space-y-4 p-5">
          <Campo label="Correo o usuario">
            <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && nombre.trim() && entrar(nombre.trim())}
              placeholder="tu.correo@ejemplo.cl" className={S.input} />
          </Campo>
          <Campo label="Contraseña">
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && entrar(nombre.trim() || "invitado_cl")}
              className={S.input} />
          </Campo>
          <button onClick={() => entrar(nombre.trim() || "invitado_cl")} className={`${S.btn} w-full`}>Ingresar</button>
          <button onClick={() => setOlvide(true)} className="block w-full text-center text-xs text-zinc-500 underline underline-offset-2">
            ¿Olvidaste tu contraseña?
          </button>
          {olvide && (
            <p className="rmt-in border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600">
              Enviamos un enlace de un solo uso a {nombre.trim() || "tu correo"}. Vence en 30 minutos y solo sirve
              desde el mismo dispositivo donde lo pediste.
            </p>
          )}
          <p className="text-center text-xs text-zinc-500">
            ¿Sin cuenta? <button onClick={() => entrar(nombre.trim() || "nuevo_usuario")} className="underline">Créala en 30 segundos</button>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   AVISOS
   ============================================================ */
function Avisos({ avisos }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-full flex-col gap-2">
      {avisos.map((a) => (
        <div key={a.id}
          className={`rmt-in flex items-start gap-2.5 border bg-white p-3 text-sm shadow-sm ${
            a.tipo === "ok" ? "border-emerald-300" : a.tipo === "alerta" ? "border-red-300" : a.tipo === "error" ? "border-zinc-900" : "border-zinc-200"}`}>
          {a.tipo === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            : a.tipo === "alerta" ? <TrendingUp size={16} className="mt-0.5 shrink-0 text-red-600" />
            : <AlertCircle size={16} className="mt-0.5 shrink-0 text-zinc-500" />}
          <span className="leading-snug">{a.texto}</span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   SUBPÁGINAS  ·  /comprar /vender /ayuda /legal
   ============================================================ */

const MAPA = [
  ["Comprar", [
    ["comprar/lotes-abiertos", "Lotes abiertos"],
    ["comprar/como-pujar", "Cómo pujar"],
    ["comprar/reglas", "Reglas del comprador"],
    ["comprar/proteccion", "Protección al comprador"],
    ["comprar/cripto", "Pagar con cripto"],
  ]],
  ["Vender", [
    ["vender/publicar", "Publicar un lote"],
    ["vender/reglas", "Reglas del vendedor"],
    ["vender/comisiones", "Comisiones"],
    ["vender/difundir", "Difundir tu lote gratis"],
    ["vender/liquidaciones", "Liquidaciones de empresas"],
    ["vender/calculadora", "Calculadora de ingresos"],
  ]],
  ["Ayuda", [
    ["ayuda/centro", "Centro de ayuda"],
    ["ayuda/envio", "Estado de un envío"],
    ["ayuda/reclamo", "Abrir un reclamo"],
    ["ayuda/contacto", "Contacto"],
  ]],
  ["Legal", [
    ["legal/terminos", "Términos y condiciones"],
    ["legal/privacidad", "Privacidad"],
    ["legal/ley-19496", "Ley 19.496"],
    ["legal/responsabilidad", "Declaración de responsabilidad"],
    ["legal/prevencion-lavado", "Prevención de lavado"],
  ]],
];

const INDICE = {};
MAPA.forEach(([sec, items]) => items.forEach(([slug, titulo]) => (INDICE[slug] = { titulo, sec })));

/* dos rutas ya existen como vistas propias */
const abrir = (ir, slug) => {
  if (slug === "comprar/lotes-abiertos") return ir("buscar", { q: "", cat: "todas" });
  if (slug === "vender/publicar") return ir("vender");
  return ir("pagina", { slug });
};

const BAJADAS = {
  "comprar/como-pujar": "Pujar acá no es apretar un botón cada vez que alguien te supera. Defines tu máximo una vez y el sistema pelea por ti.",
  "comprar/reglas": "Pujar es comprometerse. Acá está qué pasa si ganas y no pagas, cuánto cuesta echarse atrás y por qué las pujas falsas se sancionan sin aviso previo.",
  "vender/reglas": "Qué se puede publicar, qué no, y qué pasa si intentas inflar el precio de tus propios lotes.",
  "vender/difundir": "Cómo conseguir compradores sin pagar publicidad, con las herramientas que ya vienen incluidas.",
  "legal/responsabilidad": "Qué responde RematoOnline, qué responde el vendedor y qué responde el comprador. Sin letra chica.",
  "comprar/proteccion": "Tu dinero queda retenido hasta que confirmas que recibiste el lote. Si algo sale mal, lo recuperas.",
  "comprar/cripto": "Pagas en BTC, USDT o USDC. El vendedor recibe pesos. Nosotros no guardamos tus monedas en ningún momento.",
  "vender/comisiones": "Publicar es gratis. Cobramos solo cuando vendes, y el porcentaje depende de la categoría.",
  "vender/liquidaciones": "Para síndicos, empresas en cierre y retail con saldos: subimos tu inventario completo y lo rematamos por lotes.",
  "vender/calculadora": "Pon el precio que esperas obtener y te mostramos exactamente cuánto te llega a la cuenta.",
  "ayuda/centro": "Respuestas a lo que más se pregunta, ordenadas por tema.",
  "ayuda/envio": "Consulta dónde va tu lote con el código que te llegó al correo.",
  "ayuda/reclamo": "Si el lote no llegó o no corresponde a lo publicado, abre un caso acá.",
  "ayuda/contacto": "Escríbenos. Contestamos en horario hábil y siempre queda registro del caso.",
  "legal/terminos": "Las reglas del sitio. Al pujar o publicar, aceptas esto.",
  "legal/privacidad": "Qué datos pedimos, para qué los usamos y con quién los compartimos.",
  "legal/ley-19496": "Tus derechos como consumidor y cuándo aplican en un remate.",
  "legal/prevencion-lavado": "Cómo verificamos identidad y qué operaciones reportamos a la UAF.",
};

/* ---------- piezas reutilizables ---------- */
function Bloque({ titulo, n, children }) {
  return (
    <section className="border-t border-zinc-200 py-7">
      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-4">
          {n && <div className={`text-xs text-zinc-400 ${S.mono}`}>{n}</div>}
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{titulo}</h2>
        </div>
        <div className="space-y-4 text-sm leading-relaxed text-zinc-700 md:col-span-8">{children}</div>
      </div>
    </section>
  );
}

function Faq({ items }) {
  const [abierta, setAbierta] = useState(null);
  return (
    <div className="divide-y divide-zinc-200 border-y border-zinc-200">
      {items.map(([p, r], i) => (
        <div key={p}>
          <button onClick={() => setAbierta(abierta === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 py-3.5 text-left text-sm font-medium hover:text-zinc-500">
            {p}
            <ChevronDown size={15} className={`shrink-0 text-zinc-400 transition ${abierta === i ? "rotate-180" : ""}`} />
          </button>
          {abierta === i && <p className="pb-4 pr-8 text-sm leading-relaxed text-zinc-600">{r}</p>}
        </div>
      ))}
    </div>
  );
}

function Aviso({ children, Icon = Info }) {
  return (
    <div className="flex items-start gap-3 border border-zinc-200 bg-zinc-50 p-4">
      <Icon size={16} className="mt-0.5 shrink-0 text-zinc-900" />
      <p className="text-xs leading-relaxed text-zinc-600">{children}</p>
    </div>
  );
}

function Tabla({ cabeceras, filas }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b border-zinc-900 text-left ${S.label}`}>
            {cabeceras.map((c, i) => (
              <th key={c} className={`py-2 font-medium ${i ? "text-right" : ""}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {filas.map((f, i) => (
            <tr key={i}>
              {f.map((celda, j) => (
                <td key={j} className={`py-2.5 ${j ? `text-right ${S.mono}` : ""}`}>{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legal({ secciones }) {
  return (
    <div className="grid gap-8 py-4 md:grid-cols-12">
      <nav className="md:col-span-3">
        <p className={`${S.label} mb-3`}>En esta página</p>
        <ul className="space-y-2 border-l border-zinc-200 pl-3">
          {secciones.map(([t], i) => (
            <li key={t} className={`text-xs text-zinc-600 ${S.mono}`}>{String(i + 1).padStart(2, "0")} · {t}</li>
          ))}
        </ul>
      </nav>
      <div className="md:col-span-9">
        {secciones.map(([t, cuerpo], i) => (
          <section key={t} className="border-t border-zinc-200 py-6 first:border-t-0 first:pt-0">
            <h2 className="text-sm font-semibold tracking-tight">
              <span className={`mr-2 text-zinc-400 ${S.mono}`}>{String(i + 1).padStart(2, "0")}</span>{t}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-700">
              {cuerpo.map((p, j) => <p key={j}>{p}</p>)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   ENVOLTORIO
   ============================================================ */
function Pagina({ slug, ir, usuario, setAuth, avisar, lotes, now, observar }) {
  const meta = INDICE[slug];
  if (!meta) return <NoEncontrada ir={ir} />;
  const hermanos = MAPA.find(([s]) => s === meta.sec)[1].filter(([s]) => s !== slug);

  return (
    <div className="py-8">
      <div className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
        <button onClick={() => ir("home")} className="hover:text-zinc-900">Inicio</button>
        <ChevronRight size={12} />
        <span>{meta.sec}</span>
        <ChevronRight size={12} />
        <span className="text-zinc-900">{meta.titulo}</span>
        <span className={`ml-2 hidden text-zinc-300 sm:inline ${S.mono}`}>rematoonline.cl/{slug}</span>
      </div>

      <header className="mt-6 max-w-3xl border-b border-zinc-900 pb-8">
        <p className={S.label}>{meta.sec}</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tighter sm:text-5xl">{meta.titulo}</h1>
        {BAJADAS[slug] && <p className="mt-4 text-base leading-relaxed text-zinc-600">{BAJADAS[slug]}</p>}
      </header>

      <div className="mt-2">
        {slug === "comprar/como-pujar" && <ComoPujar ir={ir} />}
        {slug === "comprar/reglas" && <ReglasComprador ir={ir} />}
        {slug === "vender/reglas" && <ReglasVendedor ir={ir} />}
        {slug === "vender/difundir" && <Difundir ir={ir} avisar={avisar} lotes={lotes} />}
        {slug === "legal/responsabilidad" && <Responsabilidad />}
        {slug === "comprar/proteccion" && <Proteccion ir={ir} />}
        {slug === "comprar/cripto" && <Cripto ir={ir} />}
        {slug === "vender/comisiones" && <Comisiones ir={ir} />}
        {slug === "vender/liquidaciones" && <Liquidaciones ir={ir} avisar={avisar} />}
        {slug === "vender/calculadora" && <Calculadora ir={ir} />}
        {slug === "ayuda/centro" && <CentroAyuda ir={ir} />}
        {slug === "ayuda/envio" && <EstadoEnvio />}
        {slug === "ayuda/reclamo" && <Reclamo avisar={avisar} ir={ir} />}
        {slug === "ayuda/contacto" && <Contacto avisar={avisar} />}
        {slug === "legal/terminos" && <Terminos />}
        {slug === "legal/privacidad" && <Privacidad />}
        {slug === "legal/ley-19496" && <Ley19496 ir={ir} />}
        {slug === "legal/prevencion-lavado" && <Lavado />}
      </div>

      <section className="mt-12 border-t border-zinc-900 pt-6">
        <p className={S.label}>Sigue en {meta.sec}</p>
        <div className="mt-3 grid gap-px bg-zinc-200 sm:grid-cols-3">
          {hermanos.map(([s, t]) => (
            <button key={s} onClick={() => abrir(ir, s)}
              className="group flex items-center justify-between bg-white p-4 text-left transition hover:bg-zinc-50">
              <span className="text-sm font-medium">{t}</span>
              <ArrowRight size={15} className="text-zinc-300 transition group-hover:text-zinc-900" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function NoEncontrada({ ir }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className={`text-5xl font-semibold tracking-tighter ${S.mono}`}>404</p>
      <p className="mt-3 text-sm text-zinc-600">Esta página no existe o se movió de lugar.</p>
      <button onClick={() => ir("home")} className={`${S.btn} mt-5`}>Volver al inicio</button>
    </div>
  );
}

/* ============================================================
   COMPRAR · Cómo pujar
   ============================================================ */
function ComoPujar({ ir }) {
  const [tuMax, setTuMax] = useState(400000);
  const [rival, setRival] = useState(310000);
  const ganas = tuMax > rival;
  const precio = ganas
    ? Math.min(tuMax, rival + incrementoMin(rival))
    : Math.min(rival, tuMax + incrementoMin(tuMax));

  const tramos = [
    ["Menos de $10.000", clp(500)], ["$10.000 – $49.999", clp(1000)],
    ["$50.000 – $99.999", clp(2000)], ["$100.000 – $499.999", clp(5000)],
    ["$500.000 – $999.999", clp(10000)], ["$1.000.000 – $4.999.999", clp(20000)],
    ["$5.000.000 o más", clp(50000)],
  ];

  return (
    <div>
      <Bloque n="01" titulo="Defines tu máximo, no tu puja">
        <p>
          Cuando pujas, no dices “ofrezco $300.000”. Dices “estoy dispuesto a pagar hasta $300.000”. El sistema
          ofrece por ti lo mínimo necesario para ir ganando y sube solo cuando alguien te supera, de a un
          incremento por vez, hasta tu tope.
        </p>
        <p>Nadie ve tu máximo. Ni los otros postores, ni el vendedor, ni el equipo de RematoOnline.</p>

        <div className="border border-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-2.5"><p className={S.label}>Pruébalo</p></div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div>
              <label className={`${S.label} mb-2 block`}>Tu máximo</label>
              <input type="number" value={tuMax} onChange={(e) => setTuMax(Number(e.target.value))}
                className={`${S.input} ${S.mono}`} />
            </div>
            <div>
              <label className={`${S.label} mb-2 block`}>Máximo del otro postor</label>
              <input type="number" value={rival} onChange={(e) => setRival(Number(e.target.value))}
                className={`${S.input} ${S.mono}`} />
            </div>
          </div>
          <div className="border-t border-zinc-200 p-4">
            <p className={`text-sm font-medium ${ganas ? "text-emerald-600" : "text-red-600"}`}>
              {ganas ? "Vas ganando" : "Te superaron"}
            </p>
            <p className={`mt-1 text-3xl font-semibold tracking-tight ${S.mono}`}>{clp(precio)}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              {ganas
                ? `El lote queda en ${clp(precio)}, no en tu máximo. Pagas un incremento sobre la oferta del otro y te guardas la diferencia.`
                : `El otro postor tenía más margen. Para pasarlo necesitas al menos ${clp(rival + incrementoMin(rival))}.`}
            </p>
          </div>
        </div>
      </Bloque>

      <Bloque n="02" titulo="Cuánto sube cada puja">
        <p>El incremento no es fijo: depende de cuánto vale el lote en ese momento.</p>
        <Tabla cabeceras={["Precio actual del lote", "Incremento mínimo"]} filas={tramos} />
      </Bloque>

      <Bloque n="03" titulo="Los últimos 2 minutos">
        <p>
          En una subasta normal, quien puja un segundo antes del cierre gana sin darle chance a nadie. Acá no:
          <strong className="font-medium"> toda puja dentro de los últimos 2 minutos corre el cierre otros 2 minutos</strong>.
          El lote termina cuando pasan 2 minutos sin que nadie ofrezca más.
        </p>
        <p>La ficha muestra un contador de prórrogas para que sepas cuántas veces se extendió.</p>
        <Aviso Icon={Timer}>
          En la práctica esto significa que puedes irte a hacer otra cosa: si pusiste un máximo razonable, no
          necesitas estar mirando el reloj al final.
        </Aviso>
      </Bloque>

      <Bloque n="04" titulo="Reglas que conviene saber">
        <ul className="space-y-2">
          {[
            "Una puja es una oferta en firme. Si ganas, estás comprando.",
            "No se pueden retirar pujas, salvo error evidente de tipeo dentro de los primeros 60 segundos.",
            "Si el lote tiene precio de reserva y no se alcanza, el vendedor no está obligado a vender.",
            "Puedes subir tu máximo cuantas veces quieras. Bajarlo, no.",
            "Ganar dos veces el mismo lote no existe: hay un solo mejor postor a la vez.",
          ].map((x) => (
            <li key={x} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-zinc-400" />{x}</li>
          ))}
        </ul>
      </Bloque>

      <Bloque n="05" titulo="Preguntas frecuentes">
        <Faq items={[
          ["¿Por qué el precio subió solo si no pujé de nuevo?", "Porque otro postor ofreció por debajo de tu máximo. El sistema respondió por ti con el incremento mínimo y seguiste ganando."],
          ["¿Puedo ver el máximo de los demás?", "No. El historial muestra los montos ofertados, no los topes. Los nombres además se muestran parcialmente."],
          ["¿Qué pasa si dos personas ponen el mismo máximo?", "Gana quien lo puso primero. La otra persona necesita subir para pasar."],
          ["¿Me cobran por pujar?", "No. Pujar y comprar es gratis, la comisión la paga el vendedor."],
          ["Gané un lote, ¿ahora qué?", "Tienes 48 horas para pagar. El dinero queda retenido hasta que confirmes que recibiste el lote."],
        ]} />
      </Bloque>

      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={() => ir("buscar", { q: "", cat: "todas" })} className={S.btn}>Ver lotes abiertos <ArrowRight size={15} /></button>
        <button onClick={() => abrir(ir, "comprar/proteccion")} className={S.btnGhost}>Cómo te protegemos</button>
      </div>
    </div>
  );
}

/* ============================================================
   COMPRAR · Protección al comprador
   ============================================================ */
function Proteccion({ ir }) {
  const pasos = [
    ["Pagas", "El dinero entra a la cuenta de custodia de RematoOnline. El vendedor ve el pago confirmado, pero no lo tiene."],
    ["El vendedor despacha", "Tiene 3 días hábiles para entregar el seguimiento o coordinar el retiro."],
    ["Recibes el lote", "Revísalo antes de confirmar. Sacar fotos al abrir ayuda si después hay discusión."],
    ["Confirmas", "Recién ahí se liberan los fondos. Si no confirmas ni reclamas, se liberan solos a los 5 días de entregado."],
  ];
  return (
    <div>
      <Bloque n="01" titulo="El dinero no viaja solo">
        <p>
          En RematoOnline nunca le transfieres directo al vendedor. Pagas a una cuenta de custodia y el vendedor
          recibe recién cuando el lote está en tus manos y lo confirmaste.
        </p>
        <ol className="border-l border-zinc-200 pl-6">
          {pasos.map(([t, d], i) => (
            <li key={t} className="relative pb-5 last:pb-0">
              <span className="absolute -left-7 top-1 h-2 w-2 bg-zinc-900" />
              <p className="text-sm font-medium">{t}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{d}</p>
            </li>
          ))}
        </ol>
      </Bloque>

      <Bloque n="02" titulo="Qué cubre">
        <div className="grid gap-px bg-zinc-200 sm:grid-cols-2">
          <div className="bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-600"><Check size={15} /> Cubierto</p>
            <ul className="mt-2 space-y-1.5 text-xs text-zinc-600">
              <li>El lote nunca llegó</li>
              <li>Llegó distinto a lo publicado</li>
              <li>Llegó con fallas no declaradas</li>
              <li>Llegó incompleto (faltan unidades del lote)</li>
              <li>El vendedor no aparece para coordinar el retiro</li>
            </ul>
          </div>
          <div className="bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-500"><X size={15} /> No cubierto</p>
            <ul className="mt-2 space-y-1.5 text-xs text-zinc-600">
              <li>Fallas que estaban declaradas en la publicación</li>
              <li>Arrepentimiento después de recibir conforme</li>
              <li>Daño ocurrido después de la entrega</li>
              <li>Acuerdos hechos fuera de la plataforma</li>
              <li>Retiros no realizados dentro del plazo del lote</li>
            </ul>
          </div>
        </div>
        <Aviso Icon={AlertCircle}>
          Si alguien te propone cerrar el trato por fuera para “ahorrarse la comisión”, no lo hagas: fuera de la
          plataforma no hay custodia, no hay historial y no podemos devolverte nada.
        </Aviso>
      </Bloque>

      <Bloque n="03" titulo="Plazos">
        <Tabla cabeceras={["Situación", "Plazo"]} filas={[
          ["Pagar un lote ganado", "48 horas"],
          ["Despacho del vendedor", "3 días hábiles"],
          ["Revisar y confirmar la recepción", "5 días desde la entrega"],
          ["Abrir un reclamo", "5 días desde la entrega"],
          ["Respuesta del vendedor al reclamo", "3 días hábiles"],
          ["Resolución del caso", "Hasta 10 días hábiles"],
        ]} />
      </Bloque>

      <Bloque n="04" titulo="Si algo salió mal">
        <p>
          Abre el caso desde la ficha del lote o en Ayuda. Congelamos los fondos mientras se revisa, pedimos
          descargos al vendedor y resolvemos con lo que ambos aporten: fotos, seguimiento y la publicación original.
        </p>
        <p>
          Cuando el vendedor es una empresa, además aplican los derechos de la Ley 19.496 sobre garantía legal y
          derecho a retracto. Entre particulares, la cobertura es la de esta plataforma.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={() => abrir(ir, "ayuda/reclamo")} className={S.btn}>Abrir un reclamo</button>
          <button onClick={() => abrir(ir, "legal/ley-19496")} className={S.btnGhost}>Ver tus derechos por ley</button>
        </div>
      </Bloque>
    </div>
  );
}

/* ============================================================
   COMPRAR · Pagar con cripto
   ============================================================ */
function Cripto({ ir }) {
  const [pesos, setPesos] = useState(450000);
  return (
    <div>
      <Bloque n="01" titulo="Cómo funciona">
        <p>
          Eliges cripto en el checkout, te mostramos la dirección y el monto exacto. Al confirmarse la transacción
          en la red, la pasarela convierte a pesos y ese monto entra a custodia igual que cualquier otro pago.
        </p>
        <p>
          <strong className="font-medium">No custodiamos criptoactivos.</strong> La conversión la hace un proveedor
          de pagos externo registrado; RematoOnline solo recibe pesos. El vendedor cobra en pesos aunque tú hayas
          pagado en BTC.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Etiqueta amber><Bitcoin size={12} /> BTC</Etiqueta>
          <Etiqueta amber><Coins size={12} /> USDT (TRC-20 · ERC-20)</Etiqueta>
          <Etiqueta amber><Coins size={12} /> USDC</Etiqueta>
        </div>
      </Bloque>

      <Bloque n="02" titulo="Conversor">
        <div className="border border-zinc-900">
          <div className="border-b border-zinc-200 p-4">
            <label className={`${S.label} mb-2 block`}>Total a pagar en pesos</label>
            <input type="number" value={pesos} onChange={(e) => setPesos(Number(e.target.value))}
              className={`${S.input} ${S.mono}`} />
          </div>
          <div className="divide-y divide-zinc-100">
            {Object.entries(TASAS).map(([m, tasa]) => (
              <div key={m} className="flex items-baseline justify-between px-4 py-3">
                <span className={`text-sm ${S.mono}`}>{m}</span>
                <span className="text-right">
                  <span className={`block text-base font-medium ${S.mono}`}>
                    {(pesos / tasa).toFixed(m === "BTC" ? 6 : 2)} {m}
                  </span>
                  <span className={`block text-xs text-zinc-500 ${S.mono}`}>1 {m} = {clp(tasa)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Tasas referenciales. La tasa real se congela 15 minutos al generar la orden: si el precio se mueve en ese
          rato, el monto en pesos que recibe el vendedor no cambia.
        </p>
      </Bloque>

      <Bloque n="03" titulo="Verificación de identidad">
        <p>
          Pagos en cripto por sobre {clp(UMBRAL_KYC)} requieren verificar identidad antes de procesarse: cédula por
          ambos lados y una selfie. Es un requisito de prevención de lavado de activos, no una decisión nuestra.
        </p>
        <p>Bajo ese monto puedes pagar sin verificación, con tu cuenta ya creada.</p>
        <button onClick={() => abrir(ir, "legal/prevencion-lavado")} className={`${S.btnGhost} mt-1`}>
          <ShieldCheck size={15} /> Leer la política completa
        </button>
      </Bloque>

      <Bloque n="04" titulo="Casos raros, respuestas claras">
        <Faq items={[
          ["Pagué de menos", "Te avisamos la diferencia y tienes 2 horas para completarla a la misma dirección. Si no, se devuelve descontando el costo de red."],
          ["Pagué de más", "La diferencia se devuelve a la dirección de origen dentro de 24 horas, descontando el costo de red."],
          ["Se me pasaron los 15 minutos", "La orden expira y se genera una nueva con la tasa del momento. Si ya enviaste, el pago se acredita al valor de recepción y se ajusta la diferencia."],
          ["Envié por la red equivocada", "Escríbenos con el hash de la transacción. La recuperación depende de la red y puede tener costo; no siempre es posible."],
          ["¿Me devuelven en cripto si hay reclamo?", "No. Las devoluciones se hacen en pesos, por transferencia a tu cuenta bancaria, por el monto convertido al momento del pago."],
        ]} />
      </Bloque>
    </div>
  );
}

/* ============================================================
   VENDER · Comisiones
   ============================================================ */
function Comisiones({ ir }) {
  const filas = CATEGORIAS.map((c) => [c.nombre, Math.round((COMISIONES[c.id] ?? 0.08) * 100) + "%"]);
  const ejemplo = (monto, cat) => {
    const com = comisionDe(monto, cat);
    const iva = com * 0.19;
    return [clp(monto), clp(com), clp(iva), clp(monto - com - iva)];
  };
  return (
    <div>
      <Bloque n="01" titulo="Publicar es gratis">
        <p>
          No cobramos por publicar ni por tener el lote abierto. Si el lote no se vende, no pagas nada. La comisión
          se descuenta del precio final solo cuando la venta se concreta.
        </p>
        <p>El comprador no paga comisión. El precio que ve es el precio que paga, más el despacho.</p>
      </Bloque>

      <Bloque n="02" titulo="Comisión por categoría">
        <Tabla cabeceras={["Categoría", "Comisión sobre el precio final"]} filas={filas} />
        <p className="text-xs text-zinc-500">
          Tope de {clp(TOPE_COMISION)} por lote: sobre ese monto la comisión deja de subir. En lotes grandes eso
          hace que el porcentaje efectivo baje bastante.
        </p>
      </Bloque>

      <Bloque n="03" titulo="El IVA va sobre la comisión, no sobre tu lote">
        <p>
          La comisión es el precio de un servicio de intermediación digital y lleva IVA del 19% (Ley 21.420). Ese
          IVA se aplica sobre la comisión, no sobre el valor del bien.
        </p>
        <p>
          Si vendes como particular, el bien que vendes no genera IVA. Si vendes como empresa y el bien está
          afecto, ese IVA lo declaras tú, no nosotros.
        </p>
        <Tabla
          cabeceras={["Precio final", "Comisión", "IVA (19%)", "Recibes"]}
          filas={[ejemplo(150000, "moda"), ejemplo(450000, "tecnologia"), ejemplo(2500000, "industrial"), ejemplo(13500000, "vehiculos")]}
        />
      </Bloque>

      <Bloque n="04" titulo="Extras opcionales">
        <Tabla cabeceras={["Servicio", "Valor"]} filas={[
          ["Destacar el lote en portada por 7 días", clp(3990)],
          ["Precio de reserva", clp(2990)],
          ["Tasación con informe para lotes sobre $5.000.000", "Sin costo"],
          ["Carga masiva de inventario (10 lotes o más)", "Sin costo"],
        ]} />
      </Bloque>

      <Bloque n="05" titulo="Cuándo te llega la plata">
        <p>
          Transferimos a tu cuenta bancaria 2 días hábiles después de que el comprador confirma la recepción, o de
          que se cumple el plazo automático de 5 días sin reclamo.
        </p>
        <p>Para recibir pagos necesitas identidad verificada y una cuenta bancaria a tu nombre o de tu empresa.</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={() => abrir(ir, "vender/calculadora")} className={S.btn}>Calcular lo que recibes</button>
          <button onClick={() => ir("vender")} className={S.btnGhost}>Publicar un lote</button>
        </div>
      </Bloque>
    </div>
  );
}

/* ============================================================
   VENDER · Calculadora
   ============================================================ */
function Calculadora({ ir }) {
  const [precio, setPrecio] = useState(450000);
  const [cat, setCat] = useState("tecnologia");
  const [destacado, setDestacado] = useState(false);
  const [reserva, setReserva] = useState(false);

  const tasa = COMISIONES[cat] ?? 0.08;
  const comision = comisionDe(precio, cat);
  const iva = comision * 0.19;
  const extras = (destacado ? 3990 : 0) + (reserva ? 2990 : 0);
  const neto = Math.max(0, precio - comision - iva - extras);
  const efectivo = precio > 0 ? ((comision + iva + extras) / precio) * 100 : 0;

  return (
    <div className="grid gap-8 py-6 md:grid-cols-12">
      <div className="space-y-5 md:col-span-5">
        <div>
          <label className={`${S.label} mb-2 block`}>Precio final esperado</label>
          <input type="number" value={precio} onChange={(e) => setPrecio(Number(e.target.value))}
            className={`${S.input} ${S.mono}`} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[100000, 450000, 1500000, 8000000].map((v) => (
              <button key={v} onClick={() => setPrecio(v)}
                className={`border border-zinc-300 px-2 py-1 text-xs hover:border-zinc-900 ${S.mono}`}>{clp(v)}</button>
            ))}
          </div>
        </div>
        <div>
          <label className={`${S.label} mb-2 block`}>Categoría</label>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={S.input}>
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} · {Math.round((COMISIONES[c.id] ?? 0.08) * 100)}%</option>
            ))}
          </select>
        </div>
        <div>
          <p className={`${S.label} mb-2`}>Extras</p>
          <div className="space-y-2">
            {[["Destacar en portada 7 días", 3990, destacado, setDestacado],
              ["Precio de reserva", 2990, reserva, setReserva]].map(([t, v, on, set]) => (
              <button key={t} onClick={() => set(!on)}
                className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left text-sm ${on ? "border-zinc-900" : "border-zinc-300"}`}>
                <span className={`flex h-4 w-4 items-center justify-center border ${on ? "border-zinc-900 bg-zinc-900" : "border-zinc-300"}`}>
                  {on && <Check size={11} className="text-white" />}
                </span>
                <span className="flex-1">{t}</span>
                <span className={`text-xs text-zinc-500 ${S.mono}`}>{clp(v)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="md:col-span-7">
        <div className="border border-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-2.5"><p className={S.label}>Resultado</p></div>
          <div className="space-y-2 p-4">
            <Linea k="Precio final del lote" v={clp(precio)} />
            <Linea k={`Comisión (${Math.round(tasa * 100)}%${comision >= TOPE_COMISION ? ", con tope" : ""})`} v={"− " + clp(comision)} />
            <Linea k="IVA sobre la comisión (19%)" v={"− " + clp(iva)} />
            {extras > 0 && <Linea k="Extras contratados" v={"− " + clp(extras)} />}
            <div className="flex items-baseline justify-between border-t border-zinc-200 pt-3">
              <span className="text-sm font-medium">Depositamos a tu cuenta</span>
              <span className={`text-3xl font-semibold tracking-tight ${S.mono}`}>{clp(neto)}</span>
            </div>
            <p className={`text-xs text-zinc-500 ${S.mono}`}>
              Costo total del servicio: {efectivo.toFixed(1)}% del precio final
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-px bg-zinc-200 sm:grid-cols-3">
          {[["Publicar", "Gratis"], ["Comisión del comprador", "0%"], ["Pago a tu cuenta", "2 días hábiles"]].map(([k, v]) => (
            <div key={k} className="bg-white p-4">
              <p className={`text-sm font-medium ${S.mono}`}>{v}</p>
              <p className="mt-1 text-xs text-zinc-500">{k}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => ir("vender")} className={S.btn}>Publicar con estos números <ArrowRight size={15} /></button>
          <button onClick={() => abrir(ir, "vender/comisiones")} className={S.btnGhost}>Ver el detalle de comisiones</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   VENDER · Liquidaciones de empresas
   ============================================================ */
function Liquidaciones({ ir, avisar }) {
  const [f, setF] = useState({ empresa: "", rut: "", contacto: "", correo: "", items: "50 a 200", tipo: "Cierre de operación" });
  const [enviado, setEnviado] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <Bloque n="01" titulo="Para quién es esto">
        <div className="grid gap-px bg-zinc-200 sm:grid-cols-3">
          {[["Síndicos y liquidadores", "Realización de activos en procedimientos concursales, con acta de resultados por lote."],
            ["Empresas que cierran", "Mobiliario, equipos, vehículos y maquinaria de una operación que termina."],
            ["Retail e importadores", "Saldos de temporada, devoluciones y stock que ocupa bodega."]].map(([t, d]) => (
            <div key={t} className="bg-white p-4">
              <Building2 size={18} className="text-zinc-400" />
              <p className="mt-2 text-sm font-medium">{t}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">{d}</p>
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque n="02" titulo="Cómo trabajamos un inventario">
        <ol className="border-l border-zinc-200 pl-6">
          {[["Nos mandas el inventario", "Una planilla con descripción, cantidad y estado. Sirve el Excel que ya tienes."],
            ["Tasamos y armamos los lotes", "Sin costo. Definimos qué conviene rematar por unidad y qué por lote."],
            ["Publicamos todo el mismo día", "Fotos, fichas y fechas de cierre escalonadas para no competir contra ti mismo."],
            ["Retiro coordinado", "Ventana de retiro por bodega, con listado de compradores y horarios."],
            ["Liquidación y acta", "Un solo depósito y un reporte por lote con precio final, comisión e IVA."]].map(([t, d], i) => (
            <li key={t} className="relative pb-5 last:pb-0">
              <span className="absolute -left-7 top-1 h-2 w-2 bg-zinc-900" />
              <p className="text-sm font-medium"><span className={`mr-2 text-zinc-400 ${S.mono}`}>{String(i + 1).padStart(2, "0")}</span>{t}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{d}</p>
            </li>
          ))}
        </ol>
      </Bloque>

      <Bloque n="03" titulo="Condiciones por volumen">
        <Tabla cabeceras={["Lotes publicados", "Comisión", "Extras"]} filas={[
          ["10 a 49", "Tarifa de categoría", "Carga masiva sin costo"],
          ["50 a 199", "−1 punto porcentual", "Tasación y fotografía en terreno"],
          ["200 o más", "A convenir", "Ejecutivo asignado y calendario de cierres"],
        ]} />
        <Aviso Icon={FileText}>
          Emitimos factura por la comisión, con IVA desglosado. Para procedimientos concursales entregamos el
          reporte por lote que exige la rendición.
        </Aviso>
      </Bloque>

      <Bloque n="04" titulo="Cuéntanos qué tienes">
        {enviado ? (
          <div className="flex items-start gap-3 border border-zinc-900 p-5">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">Solicitud recibida</p>
              <p className="mt-1 text-sm text-zinc-600">
                Un ejecutivo te escribe a {f.correo || "tu correo"} dentro de 1 día hábil con la propuesta de lotes.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 border border-zinc-200 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Empresa"><input value={f.empresa} onChange={(e) => set("empresa", e.target.value)} className={S.input} placeholder="Razón social" /></Campo>
              <Campo label="RUT"><input value={f.rut} onChange={(e) => set("rut", e.target.value)} className={`${S.input} ${S.mono}`} placeholder="76.543.210-K" /></Campo>
              <Campo label="Contacto"><input value={f.contacto} onChange={(e) => set("contacto", e.target.value)} className={S.input} placeholder="Nombre y apellido" /></Campo>
              <Campo label="Correo"><input value={f.correo} onChange={(e) => set("correo", e.target.value)} className={S.input} placeholder="contacto@empresa.cl" /></Campo>
              <Campo label="Cantidad de ítems">
                <select value={f.items} onChange={(e) => set("items", e.target.value)} className={S.input}>
                  {["Menos de 50", "50 a 200", "200 a 1.000", "Más de 1.000"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </Campo>
              <Campo label="Situación">
                <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} className={S.input}>
                  {["Cierre de operación", "Procedimiento concursal", "Saldos de stock", "Renovación de activos"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </Campo>
            </div>
            <button onClick={() => { setEnviado(true); avisar("Solicitud enviada. Te contactamos en 1 día hábil.", "ok"); }}
              className={S.btn}>Enviar inventario <ArrowRight size={15} /></button>
          </div>
        )}
      </Bloque>
    </div>
  );
}

/* ============================================================
   AYUDA · Centro de ayuda
   ============================================================ */
function CentroAyuda({ ir }) {
  const [busca, setBusca] = useState("");
  const temas = [
    ["Pujas y subastas", "comprar/como-pujar", Gavel, ["Cómo funciona la puja automática", "Incrementos mínimos", "Prórroga de los últimos 2 minutos", "Retirar una puja"]],
    ["Pagos y custodia", "comprar/proteccion", Lock, ["Medios de pago aceptados", "Cuándo se libera el dinero", "Plazo para pagar un lote ganado", "Devoluciones"]],
    ["Cripto", "comprar/cripto", Bitcoin, ["Monedas y redes aceptadas", "Tasa congelada 15 minutos", "Verificación de identidad", "Pagué de menos o de más"]],
    ["Envíos y retiros", "ayuda/envio", Truck, ["Seguir un envío", "Plazos de despacho", "Retiro en persona", "El lote llegó dañado"]],
    ["Vender", "vender/comisiones", Hammer, ["Comisiones e IVA", "Cuándo recibo el pago", "Carga masiva de inventario", "Precio de reserva"]],
    ["Cuenta", "ayuda/contacto", User, ["Verificar identidad", "Cambiar cuenta bancaria", "Notificaciones de puja", "Cerrar la cuenta"]],
  ];
  const preguntas = [
    ["¿Cuánto cuesta comprar?", "Nada. El comprador no paga comisión, solo el precio del lote y el despacho si corresponde."],
    ["Gané un lote, ¿en cuánto tengo que pagar?", "48 horas desde el cierre. Pasado ese plazo el lote puede ofrecerse al segundo mejor postor."],
    ["¿Puedo ver el lote antes de pujar?", "En lotes de empresas casi siempre hay visitas con cita previa. Está indicado en la ficha."],
    ["¿Cómo sé si un vendedor es confiable?", "Mira el porcentaje de calificación positiva y la cantidad de ventas. Las cuentas de empresa además tienen identidad tributaria verificada."],
    ["¿Emiten boleta o factura?", "Sí, por la comisión de intermediación. El documento por el bien lo emite el vendedor cuando es empresa."],
    ["¿Puedo comprar desde regiones?", "Sí. Fíjate si el lote tiene despacho o es solo retiro: los lotes grandes suelen ser retiro obligatorio."],
    ["Olvidé mi contraseña", "Usa “¿Olvidaste tu contraseña?” en la pantalla de ingreso. Llega un enlace de un solo uso a tu correo."],
  ];
  const filtradas = preguntas.filter(([p, r]) => (p + r).toLowerCase().includes(busca.toLowerCase()));

  return (
    <div>
      <div className="flex items-stretch border border-zinc-900 py-0">
        <span className="flex items-center px-4 text-zinc-400"><Search size={16} /></span>
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Busca tu pregunta: pago, retiro, cripto, reclamo…"
          className="w-full py-3.5 pr-4 text-sm placeholder-zinc-400 focus:outline-none" />
      </div>

      <Bloque n="01" titulo="Temas">
        <div className="grid gap-px bg-zinc-200 sm:grid-cols-2">
          {temas.map(([t, destino, Icon, items]) => (
            <button key={t} onClick={() => abrir(ir, destino)} className="group bg-white p-4 text-left transition hover:bg-zinc-50">
              <div className="flex items-center justify-between">
                <Icon size={18} className="text-zinc-400" />
                <ArrowRight size={15} className="text-zinc-300 transition group-hover:text-zinc-900" />
              </div>
              <p className="mt-2 text-sm font-medium">{t}</p>
              <ul className="mt-1.5 space-y-0.5">
                {items.map((i) => <li key={i} className="text-xs text-zinc-500">{i}</li>)}
              </ul>
            </button>
          ))}
        </div>
      </Bloque>

      <Bloque n="02" titulo={busca ? `Resultados (${filtradas.length})` : "Lo que más se pregunta"}>
        {filtradas.length ? <Faq items={filtradas} /> : (
          <div className="border border-dashed border-zinc-300 px-6 py-12 text-center">
            <p className="text-sm font-medium">Nada coincide con “{busca}”</p>
            <button onClick={() => abrir(ir, "ayuda/contacto")} className={`${S.btnGhost} mt-4`}>Escríbenos directo</button>
          </div>
        )}
      </Bloque>

      <Bloque n="03" titulo="¿Sigues atascado?">
        <div className="flex flex-wrap gap-3">
          <button onClick={() => abrir(ir, "ayuda/envio")} className={S.btnGhost}><Truck size={15} /> Seguir un envío</button>
          <button onClick={() => abrir(ir, "ayuda/reclamo")} className={S.btnGhost}><Flag size={15} /> Abrir un reclamo</button>
          <button onClick={() => abrir(ir, "ayuda/contacto")} className={S.btn}>Contactar soporte</button>
        </div>
      </Bloque>
    </div>
  );
}

/* ============================================================
   AYUDA · Estado de un envío
   ============================================================ */
function EstadoEnvio() {
  const [codigo, setCodigo] = useState("");
  const [orden, setOrden] = useState(null);
  const [error, setError] = useState("");

  const etapas = ["Pago retenido", "Vendedor preparando", "En tránsito", "Entregado", "Fondos liberados"];

  const consultar = () => {
    const c = codigo.trim().toUpperCase();
    if (!/^RMT-\d{4}$/.test(c)) {
      setOrden(null);
      setError("El código tiene el formato RMT-0000. Está en el correo de confirmación y en Mi cuenta.");
      return;
    }
    const suma = c.slice(4).split("").reduce((a, d) => a + Number(d), 0);
    setError("");
    setOrden({
      codigo: c,
      etapa: suma % 5,
      courier: suma % 2 ? "Chilexpress" : "Starken",
      seguimiento: "CL" + (100000000 + suma * 7351),
      lote: "LOTE " + String(40 + (suma % 200)).padStart(4, "0"),
    });
  };

  return (
    <div>
      <Bloque n="01" titulo="Consulta tu pedido">
        <div className="flex flex-wrap gap-2">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && consultar()}
            placeholder="RMT-4821" className={`${S.input} ${S.mono} flex-1`} />
          <button onClick={consultar} className={S.btn}>Consultar</button>
        </div>
        {error && <p className="flex items-center gap-2 text-xs text-red-600"><AlertCircle size={13} />{error}</p>}
        {!orden && !error && <p className="text-xs text-zinc-500">Prueba con RMT-4821 para ver un ejemplo.</p>}

        {orden && (
          <div className="border border-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
              <div>
                <p className={`text-sm font-medium ${S.mono}`}>{orden.codigo}</p>
                <p className={`text-xs text-zinc-500 ${S.mono}`}>{orden.lote}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">{orden.courier}</p>
                <p className={`text-xs ${S.mono}`}>{orden.seguimiento}</p>
              </div>
            </div>
            <ol className="border-l border-zinc-200 p-5 pl-11">
              {etapas.map((e, i) => (
                <li key={e} className="relative pb-5 last:pb-0">
                  <span className={`absolute -left-7 top-1 h-2 w-2 ${i <= orden.etapa ? "bg-zinc-900" : "border border-zinc-300 bg-white"}`} />
                  <p className={`text-sm ${i === orden.etapa ? "font-medium" : "text-zinc-500"}`}>{e}</p>
                  {i === orden.etapa && (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {["El vendedor ya fue notificado y tiene 3 días hábiles para despachar.",
                        "Está empaquetando el lote. Pronto verás el número de seguimiento.",
                        "Va en camino. El courier actualiza el estado cada 12 horas.",
                        "Revisa el lote y confirma la recepción. Tienes 5 días para reclamar.",
                        "Listo. El vendedor recibió el pago."][i]}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Bloque>

      <Bloque n="02" titulo="Plazos de entrega">
        <Tabla cabeceras={["Destino", "Plazo estimado"]} filas={[
          ["Región Metropolitana", "1 a 2 días hábiles"],
          ["Capitales regionales", "2 a 4 días hábiles"],
          ["Zonas extremas y localidades apartadas", "4 a 8 días hábiles"],
          ["Retiro en persona", "Según ventana del vendedor, hasta 5 días hábiles"],
        ]} />
        <Aviso Icon={Package}>
          Lotes voluminosos (maquinaria, mobiliario en cantidad, vehículos) son siempre retiro con transporte
          propio. Está indicado en la ficha antes de pujar.
        </Aviso>
      </Bloque>
    </div>
  );
}

/* ============================================================
   AYUDA · Abrir un reclamo
   ============================================================ */
function Reclamo({ avisar, ir }) {
  const [paso, setPaso] = useState(1);
  const [f, setF] = useState({ codigo: "", motivo: "No llegó el lote", detalle: "", esperado: "Devolución del dinero", fotos: 0 });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const caso = "RMT-C-" + String(1000 + (f.codigo.length * 37) % 8999);

  return (
    <div>
      {paso < 3 ? (
        <>
          <Bloque n="01" titulo="Antes de empezar">
            <p>
              Puedes abrir un caso hasta 5 días después de la entrega. Mientras se revisa, el dinero queda
              congelado en custodia: el vendedor no lo recibe.
            </p>
            <p>Ten a mano el código del pedido y fotos de lo que recibiste, incluido el embalaje.</p>
          </Bloque>

          <Bloque n="02" titulo={paso === 1 ? "Qué pasó" : "Qué esperas"}>
            {paso === 1 ? (
              <div className="space-y-4">
                <Campo label="Código del pedido">
                  <input value={f.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="RMT-4821" className={`${S.input} ${S.mono}`} />
                </Campo>
                <Campo label="Motivo">
                  <div className="space-y-px bg-zinc-200">
                    {["No llegó el lote", "Llegó distinto a lo publicado", "Llegó dañado o incompleto",
                      "El vendedor no responde para coordinar el retiro", "Otro problema"].map((m) => (
                      <button key={m} onClick={() => set("motivo", m)}
                        className={`flex w-full items-center gap-3 bg-white px-3 py-2.5 text-left text-sm ${f.motivo === m ? "ring-1 ring-inset ring-zinc-900" : "hover:bg-zinc-50"}`}>
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${f.motivo === m ? "border-zinc-900" : "border-zinc-300"}`}>
                          {f.motivo === m && <span className="h-2 w-2 rounded-full bg-zinc-900" />}
                        </span>
                        {m}
                      </button>
                    ))}
                  </div>
                </Campo>
                <button onClick={() => setPaso(2)} className={S.btn}>Continuar <ArrowRight size={15} /></button>
              </div>
            ) : (
              <div className="space-y-4">
                <Campo label="Cuéntanos el detalle">
                  <textarea rows={5} value={f.detalle} onChange={(e) => set("detalle", e.target.value)}
                    placeholder="Qué esperabas recibir, qué recibiste y qué conversaste con el vendedor."
                    className={S.input} />
                </Campo>
                <Campo label={`Evidencia · ${f.fotos} archivos`}>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      i < f.fotos ? (
                        <div key={i} className="relative flex aspect-square items-center justify-center border border-zinc-200 bg-zinc-50">
                          <Package size={18} strokeWidth={1} className="text-zinc-300" />
                          <button onClick={() => set("fotos", f.fotos - 1)} aria-label="Quitar archivo"
                            className="absolute right-1 top-1 border border-zinc-200 bg-white p-0.5 text-zinc-400 hover:text-zinc-900"><X size={11} /></button>
                        </div>
                      ) : (
                        <button key={i} onClick={() => set("fotos", f.fotos + 1)}
                          className="flex aspect-square flex-col items-center justify-center gap-1 border border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-900 hover:text-zinc-900">
                          <Upload size={16} /><span className="text-xs">Foto</span>
                        </button>
                      )
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Una foto del embalaje cerrado y una del contenido resuelven la mayoría de los casos.</p>
                </Campo>
                <Campo label="Qué solución buscas">
                  <select value={f.esperado} onChange={(e) => set("esperado", e.target.value)} className={S.input}>
                    {["Devolución del dinero", "Reemplazo del lote", "Devolución parcial", "Que el vendedor cumpla el despacho"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Campo>
                <div className="flex gap-3">
                  <button onClick={() => setPaso(1)} className={S.btnGhost}><ArrowLeft size={15} /> Atrás</button>
                  <button onClick={() => { setPaso(3); avisar("Reclamo abierto. Fondos congelados.", "ok"); }} className={S.btn}>
                    Abrir el caso
                  </button>
                </div>
              </div>
            )}
          </Bloque>
        </>
      ) : (
        <div className="py-6">
          <div className="flex items-start gap-3 border border-zinc-900 p-5">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">Caso {caso} abierto</p>
              <p className="mt-1 text-sm text-zinc-600">
                Los fondos del pedido {f.codigo || "—"} quedaron congelados. Te llegará copia al correo.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <p className={`${S.label} mb-3`}>Qué viene ahora</p>
            <ol className="border-l border-zinc-200 pl-6">
              {[["Le pedimos descargos al vendedor", "Tiene 3 días hábiles para responder con su versión y evidencia."],
                ["Revisamos el caso", "Comparamos la publicación original, el seguimiento y las fotos de ambas partes."],
                ["Resolvemos", "Hasta 10 días hábiles. Si te damos la razón, la devolución llega en 2 días hábiles a tu medio de pago."]].map(([t, d]) => (
                <li key={t} className="relative pb-5 last:pb-0">
                  <span className="absolute -left-7 top-1 h-2 w-2 bg-zinc-900" />
                  <p className="text-sm font-medium">{t}</p>
                  <p className="mt-0.5 text-xs text-zinc-600">{d}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => ir("cuenta")} className={S.btn}>Ver mis compras</button>
            <button onClick={() => abrir(ir, "comprar/proteccion")} className={S.btnGhost}>Leer la cobertura</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   AYUDA · Contacto
   ============================================================ */
function Contacto({ avisar }) {
  const [f, setF] = useState({ nombre: "", correo: "", tema: "Problema con una compra", mensaje: "" });
  const [listo, setListo] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="grid gap-8 py-6 md:grid-cols-12">
      <div className="md:col-span-5">
        <p className={S.label}>Canales</p>
        <ul className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200">
          {[[FileText, "Formulario", "Respuesta en 1 día hábil. Queda número de caso."],
            [Wallet, "soporte@rematoonline.cl", "Para temas de pagos, custodia y devoluciones."],
            [Building2, "empresas@rematoonline.cl", "Liquidaciones, síndicos y carga masiva de inventario."],
            [ShieldCheck, "cumplimiento@rematoonline.cl", "Verificación de identidad y prevención de lavado."]].map(([Icon, t, d]) => (
            <li key={t} className="flex gap-3 py-3.5">
              <Icon size={16} className="mt-0.5 shrink-0 text-zinc-400" />
              <div>
                <p className="text-sm font-medium">{t}</p>
                <p className="mt-0.5 text-xs text-zinc-600">{d}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 space-y-1 text-xs text-zinc-600">
          <p className="font-medium text-zinc-900">RematoOnline SpA</p>
          <p>Av. Providencia 1234, oficina 802 · Providencia, Santiago</p>
          <p className={S.mono}>Lunes a viernes, 9:00 a 18:00</p>
        </div>
      </div>

      <div className="md:col-span-7">
        {listo ? (
          <div className="flex items-start gap-3 border border-zinc-900 p-5">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">Mensaje enviado</p>
              <p className="mt-1 text-sm text-zinc-600">
                Te respondemos a {f.correo || "tu correo"} dentro de 1 día hábil.
              </p>
              <button onClick={() => { setListo(false); setF({ nombre: "", correo: "", tema: "Problema con una compra", mensaje: "" }); }}
                className={`${S.btnGhost} mt-4`}>Escribir otro mensaje</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 border border-zinc-200 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nombre"><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} className={S.input} /></Campo>
              <Campo label="Correo"><input value={f.correo} onChange={(e) => set("correo", e.target.value)} className={S.input} placeholder="tu.correo@ejemplo.cl" /></Campo>
            </div>
            <Campo label="Tema">
              <select value={f.tema} onChange={(e) => set("tema", e.target.value)} className={S.input}>
                {["Problema con una compra", "Problema con una venta", "Pagos y devoluciones", "Verificación de identidad", "Liquidación de empresa", "Otro"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </Campo>
            <Campo label="Mensaje">
              <textarea rows={6} value={f.mensaje} onChange={(e) => set("mensaje", e.target.value)}
                placeholder="Si es sobre un pedido, incluye el código RMT-0000." className={S.input} />
            </Campo>
            <button onClick={() => { setListo(true); avisar("Mensaje enviado a soporte.", "ok"); }} className={S.btn}>
              Enviar mensaje <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   LEGAL
   ============================================================ */
function Terminos() {
  return (
    <>
      <p className={`py-4 text-xs text-zinc-500 ${S.mono}`}>Última actualización: 1 de julio de 2026</p>
      <Legal secciones={[
        ["Qué es RematoOnline", [
          "RematoOnline SpA opera una plataforma digital que conecta a vendedores y compradores para la realización de remates en línea. No somos parte de la compraventa: prestamos un servicio de intermediación y de custodia del pago.",
          "El contrato de compraventa se celebra directamente entre el vendedor y el comprador que resulte adjudicatario del lote.",
        ]],
        ["Cuenta de usuario", [
          "Para pujar, comprar o vender necesitas una cuenta con datos reales y verificables. Eres responsable de mantener la confidencialidad de tus credenciales y de toda actividad realizada desde tu cuenta.",
          "Podemos suspender cuentas con datos falsos, con pujas coordinadas para inflar precios, o que incumplan reiteradamente los plazos de pago o despacho.",
        ]],
        ["Pujas", [
          "Toda puja es una oferta de compra en firme e irrevocable. Si resultas adjudicatario, estás obligado a pagar dentro de 48 horas.",
          "El sistema puja automáticamente por ti hasta el máximo que indiques, usando el incremento mínimo correspondiente al tramo de precio.",
          "Una puja ingresada dentro de los últimos 2 minutos extiende el cierre del lote por 2 minutos adicionales, tantas veces como sea necesario.",
          "Solo se admite la retractación de una puja dentro de los primeros 60 segundos y por error manifiesto de digitación.",
        ]],
        ["Publicaciones", [
          "El vendedor es responsable de la veracidad de la descripción, de las fotografías y de declarar las fallas conocidas del lote. Debe estar facultado para disponer del bien.",
          "No se admiten publicaciones de bienes de comercio prohibido, armas, fármacos, especies protegidas, documentos de identidad, ni bienes de procedencia ilícita o sin respaldo de dominio cuando la ley lo exija.",
          "Podemos retirar publicaciones que infrinjan estas reglas, sin derecho a indemnización.",
        ]],
        ["Comisiones e impuestos", [
          "Publicar es gratuito. El vendedor paga una comisión de intermediación solo cuando la venta se concreta, según la tarifa vigente de la categoría, con un tope por lote.",
          "La comisión constituye un servicio afecto a IVA conforme a la Ley 21.420. El impuesto se calcula sobre la comisión y no sobre el valor del bien rematado.",
          "Los tributos que afecten al bien vendido son de cargo exclusivo del vendedor.",
        ]],
        ["Custodia del pago", [
          "Los pagos ingresan a una cuenta de custodia administrada por RematoOnline y se liberan al vendedor una vez que el comprador confirma la recepción, o transcurridos 5 días desde la entrega sin reclamo.",
          "Si se abre un reclamo dentro de plazo, los fondos permanecen retenidos hasta la resolución del caso.",
        ]],
        ["Pagos con criptoactivos", [
          "Los pagos en criptoactivos son procesados por un proveedor externo que convierte el monto a pesos chilenos. RematoOnline no custodia criptoactivos ni presta servicios de intermediación de instrumentos financieros.",
          "El tipo de cambio se fija al generar la orden y se mantiene por 15 minutos. Las devoluciones se realizan siempre en pesos chilenos.",
        ]],
        ["Responsabilidad", [
          "No respondemos por el estado, calidad, funcionamiento ni titularidad de los bienes rematados, sin perjuicio de la cobertura de protección al comprador descrita en el sitio.",
          "Tampoco respondemos por interrupciones del servicio provocadas por fuerza mayor, fallas de terceros proveedores o cortes de conectividad ajenos a nuestra infraestructura.",
        ]],
        ["Modificaciones y ley aplicable", [
          "Podemos modificar estos términos avisando con 10 días de anticipación por correo y en el sitio. Los lotes ya adjudicados se rigen por la versión vigente al momento del cierre.",
          "Estos términos se rigen por la ley chilena. Cualquier controversia se somete a los tribunales ordinarios de justicia de Santiago, sin perjuicio de los derechos del consumidor establecidos en la Ley 19.496.",
        ]],
      ]} />
    </>
  );
}

function Privacidad() {
  return (
    <>
      <p className={`py-4 text-xs text-zinc-500 ${S.mono}`}>Última actualización: 1 de julio de 2026</p>
      <Legal secciones={[
        ["Quién trata tus datos", [
          "RematoOnline SpA, con domicilio en Providencia, Santiago, es responsable del tratamiento de los datos personales que recogemos a través del sitio, conforme a la Ley 19.628 sobre protección de la vida privada.",
        ]],
        ["Qué datos recogemos", [
          "De identificación: nombre, RUT, correo, teléfono y dirección de despacho.",
          "De verificación: imagen de cédula de identidad y selfie, cuando corresponde verificar identidad para vender o para pagos en criptoactivos sobre el umbral establecido.",
          "De actividad: pujas, compras, ventas, mensajes con otros usuarios y reclamos.",
          "Técnicos: dirección IP, tipo de dispositivo y navegador, con fines de seguridad y prevención de fraude.",
        ]],
        ["Para qué los usamos", [
          "Para operar el remate y ejecutar la compraventa: mostrar tu nombre parcialmente enmascarado en el historial de pujas, entregar tus datos de despacho al vendedor adjudicado y procesar el pago.",
          "Para cumplir obligaciones legales de identificación de clientes y conservación de registros.",
          "Para prevenir fraude, pujas coordinadas y uso indebido de la plataforma.",
          "Para enviarte avisos operativos: puja superada, cierre de lote, estado del pago. Los mensajes comerciales requieren tu consentimiento y puedes revocarlo cuando quieras.",
        ]],
        ["Con quién los compartimos", [
          "Con la contraparte de una operación adjudicada, en lo estrictamente necesario para la entrega.",
          "Con proveedores de pago (Transbank y Flow), con la pasarela de criptoactivos y con couriers, únicamente para procesar la transacción o el envío.",
          "Con autoridades cuando exista requerimiento fundado, y con la Unidad de Análisis Financiero en los casos que la ley obliga a reportar.",
          "No vendemos ni arrendamos bases de datos a terceros.",
        ]],
        ["Cuánto tiempo los guardamos", [
          "Los datos de operaciones y de verificación de identidad se conservan por 5 años desde la última transacción, plazo exigido por la normativa de prevención de lavado de activos.",
          "Los datos de cuentas cerradas sin operaciones se eliminan a los 12 meses.",
        ]],
        ["Tus derechos", [
          "Puedes solicitar acceso, rectificación, cancelación y oposición al tratamiento de tus datos escribiendo a privacidad@rematoonline.cl. Respondemos dentro de 15 días hábiles.",
          "La cancelación no procede sobre datos que debemos conservar por mandato legal ni sobre el historial de operaciones ya cerradas.",
        ]],
        ["Cookies", [
          "Usamos cookies propias para mantener tu sesión iniciada y recordar filtros de búsqueda, y cookies de medición para entender qué páginas se usan. Puedes bloquearlas desde tu navegador; si bloqueas las de sesión, no podrás pujar.",
        ]],
      ]} />
    </>
  );
}

function Ley19496({ ir }) {
  return (
    <div>
      <Bloque n="01" titulo="Cuándo aplica">
        <p>
          La Ley 19.496 protege al consumidor cuando la contraparte es un proveedor, es decir, alguien que vende de
          forma habitual. En RematoOnline eso ocurre cuando compras a una cuenta de empresa.
        </p>
        <p>
          En ventas entre particulares no hay relación de consumo y la ley no aplica. En ese caso te ampara la
          protección al comprador de esta plataforma y las reglas del Código Civil sobre vicios ocultos.
        </p>
        <Tabla cabeceras={["Compras a", "Ley 19.496", "Protección de la plataforma"]} filas={[
          ["Cuenta de empresa", "Sí", "Sí"],
          ["Cuenta de particular", "No", "Sí"],
        ]} />
      </Bloque>

      <Bloque n="02" titulo="Garantía legal">
        <p>
          Ante un producto con fallas comprado a una empresa, tienes derecho a elegir entre reparación, cambio o
          devolución del dinero dentro de 6 meses desde la recepción.
        </p>
        <p>
          La garantía no cubre los desperfectos declarados en la publicación. En bienes usados y en lotes de
          liquidación, la descripción del estado es parte del contrato: por eso exigimos declarar las fallas conocidas.
        </p>
      </Bloque>

      <Bloque n="03" titulo="Derecho a retracto">
        <p>
          En compras a distancia a un proveedor, la ley reconoce 10 días para retractarse sin expresar causa,
          salvo que el proveedor haya dispuesto expresamente lo contrario en la oferta.
        </p>
        <p>
          En remates, la adjudicación es el resultado de una puja en firme y las publicaciones de empresa indican
          si el retracto está excluido. Cuando no se excluye, puedes ejercerlo desde la ficha del lote.
        </p>
        <Aviso Icon={Info}>
          Excluir el retracto no permite excluir la garantía legal: son cosas distintas. Un producto con falla no
          declarada siempre da derecho a reclamo.
        </Aviso>
      </Bloque>

      <Bloque n="04" titulo="Otros derechos que sí aplican">
        <ul className="space-y-2">
          {["Información veraz y oportuna sobre el bien, el precio final y los costos de despacho.",
            "No ser discriminado arbitrariamente por el proveedor.",
            "Documento tributario por la compra cuando el vendedor es empresa.",
            "Que no se te cobren montos no informados antes de la adjudicación.",
            "Reclamar ante el SERNAC si el proveedor no responde."].map((x) => (
            <li key={x} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-zinc-400" />{x}</li>
          ))}
        </ul>
      </Bloque>

      <Bloque n="05" titulo="Cómo ejercerlos">
        <p>
          Primero abre un reclamo en la plataforma: congelamos los fondos y pedimos descargos al vendedor. Es la
          vía más rápida porque el dinero todavía no sale de custodia.
        </p>
        <p>
          Si no quedas conforme con la resolución, conservas intactos tus derechos para reclamar ante el SERNAC o
          demandar ante el juzgado de policía local que corresponda a tu domicilio.
        </p>
        <button onClick={() => abrir(ir, "ayuda/reclamo")} className={`${S.btn} mt-1`}>Abrir un reclamo</button>
      </Bloque>
    </div>
  );
}

function Lavado() {
  return (
    <>
      <p className={`py-4 text-xs text-zinc-500 ${S.mono}`}>Última actualización: 1 de julio de 2026</p>
      <Legal secciones={[
        ["Por qué existe esta política", [
          "Un remate en línea que acepta pagos en criptoactivos es un canal atractivo para intentar dar apariencia lícita a fondos de origen desconocido. Esta política describe los controles con que RematoOnline previene ese uso, en línea con la Ley 19.913 y las instrucciones de la Unidad de Análisis Financiero.",
        ]],
        ["Conoce a tu cliente", [
          "Toda cuenta que venda o que reciba pagos debe verificar identidad: cédula por ambos lados, selfie de contraste y cuenta bancaria a nombre del titular.",
          "Las cuentas de empresa acreditan además RUT, escritura o estatuto vigente y la identidad del representante legal.",
          "Los pagos en criptoactivos superiores a " + clp(UMBRAL_KYC) + " requieren verificación previa, aunque la cuenta solo esté comprando.",
        ]],
        ["Monitoreo de operaciones", [
          "Revisamos patrones inusuales: pujas entre cuentas vinculadas, adjudicaciones seguidas de reversas, fraccionamiento de pagos para quedar bajo los umbrales, o lotes cuyo precio final se aleja sin explicación del valor de mercado.",
          "Podemos pedir antecedentes sobre el origen de los fondos y retener la liberación del pago mientras se aclaran.",
        ]],
        ["Reportes a la autoridad", [
          "Cuando una operación resulta sospechosa, se reporta a la Unidad de Análisis Financiero mediante un Reporte de Operación Sospechosa. La ley prohíbe informar al usuario que su operación fue reportada.",
          "También se informan las operaciones en efectivo sobre el umbral legal, aunque la plataforma no opera con efectivo.",
        ]],
        ["Custodia y conservación", [
          "RematoOnline no custodia criptoactivos: la conversión a pesos la realiza un proveedor externo registrado, y solo recibimos moneda de curso legal.",
          "Los antecedentes de identificación y las operaciones se conservan por 5 años desde la última transacción.",
        ]],
        ["Prohibiciones", [
          "Está prohibido operar con fondos de origen ilícito, usar cuentas de terceros, o rematar bienes sin respaldo de dominio cuando la ley exige acreditarlo.",
          "El incumplimiento habilita el cierre inmediato de la cuenta, la retención de los fondos involucrados y el reporte a la autoridad competente.",
        ]],
        ["Contacto de cumplimiento", [
          "Consultas y requerimientos de autoridad: cumplimiento@rematoonline.cl.",
        ]],
      ]} />
    </>
  );
}

/* ============================================================
   REGLAS · PENALIZACIONES · RESPONSABILIDAD
   ============================================================ */

/* multa por adjudicarse un lote y no pagarlo.
   compensa dos cosas distintas: el tiempo que el lote estuvo bloqueado
   y los recursos que el vendedor y la plataforma ya gastaron. */
const MULTA = {
  base: 0.10,           // sobre el precio adjudicado
  tope: 150000,         // tope de la parte proporcional
  porDia: 2000,         // por cada día que el lote estuvo publicado
  reparto: 0.70,        // parte que va al vendedor; el resto cubre costos de plataforma
  pasarela: 0.0295,     // costo no reembolsable si ya había pagado
  pasarelaFija: 300,
};

const FALTAS = [
  ["Primera falta", 1, "7 días sin poder pujar", "Se avisa al correo y queda registrada en la cuenta."],
  ["Segunda falta", 1.5, "30 días sin poder pujar", "Para volver a pujar se exige garantía retenida en todos los lotes."],
  ["Tercera falta", 2, "Cuenta cerrada", "La multa impaga pasa a cobranza y se informa al vendedor afectado."],
];

const calcularMulta = ({ precio, dias, extras, yaPago, falta }) => {
  const proporcional = Math.min(precio * MULTA.base, MULTA.tope);
  const tiempo = dias * MULTA.porDia;
  const reversa = yaPago ? precio * MULTA.pasarela + MULTA.pasarelaFija : 0;
  const bruto = (proporcional + tiempo + extras + reversa) * FALTAS[falta][1];
  return {
    proporcional, tiempo, extras, reversa,
    total: bruto,
    vendedor: bruto * MULTA.reparto,
    plataforma: bruto * (1 - MULTA.reparto),
  };
};

/* umbrales para poder pujar: suben con el valor del lote */
const NIVELES_PUJA = [
  ["Correo confirmado", "Hasta " + clp(200000), "Basta con crear la cuenta y confirmar el correo."],
  ["Identidad verificada", "Hasta " + clp(2000000), "Cédula por ambos lados y selfie de contraste."],
  ["Garantía retenida", "Sobre " + clp(2000000), "Retención del 5% en tu tarjeta, tope " + clp(100000) + ". Se libera sola si no ganas."],
];

/* ============================================================
   COMPRAR · Reglas del comprador
   ============================================================ */
function ReglasComprador({ ir }) {
  const [c, setC] = useState({ precio: 340000, dias: 6, extras: 3990, yaPago: false, falta: 0 });
  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const m = calcularMulta(c);

  return (
    <div>
      <Bloque n="01" titulo="Pujar es comprometerse">
        <p>
          Una puja no es una consulta ni una reserva: es una oferta de compra en firme. Si eres el mejor postor
          cuando el lote cierra, el lote es tuyo y tienes 48 horas para pagarlo.
        </p>
        <p>
          Esto no es rigidez por gusto. Mientras tu puja está arriba, el vendedor deja de buscar comprador y los
          demás postores se retiran. Si después te arrepientes, el costo de esa semana perdida ya está gastado.
        </p>
        <Tabla cabeceras={["Momento", "Puedes echarte atrás"]} filas={[
          ["Antes de que cierre el lote, dentro de los primeros 60 segundos de tu puja", "Sí, solo por error de digitación"],
          ["Antes de que cierre el lote, después de esos 60 segundos", "No"],
          ["Ganaste y aún no pagas", "No sin multa"],
          ["Ya pagaste, el lote no ha salido", "Depende del vendedor"],
          ["Ya recibiste el lote", "Solo por garantía o retracto legal"],
        ]} />
      </Bloque>

      <Bloque n="02" titulo="Si ganas y no pagas">
        <p>
          A las 48 horas sin pago, el lote se libera y pasa automáticamente al segundo mejor postor, que tiene
          24 horas para tomarlo al precio de su propio máximo. El vendedor no pierde la venta.
        </p>
        <p>Tú sí quedas con una multa. Se calcula sobre dos cosas concretas, no sobre un porcentaje al azar:</p>
        <ul className="space-y-2">
          <li className="flex gap-2"><Clock size={15} className="mt-0.5 shrink-0 text-zinc-400" />
            <span><strong className="font-medium">Tiempo:</strong> los días que el lote estuvo publicado y bloqueado por tu puja.</span></li>
          <li className="flex gap-2"><Coins size={15} className="mt-0.5 shrink-0 text-zinc-400" />
            <span><strong className="font-medium">Recursos:</strong> lo que el vendedor ya gastó en destacar o tasar el lote, más el costo de procesar y revertir el pago si alcanzaste a pagarlo.</span></li>
        </ul>
        <p>
          El {Math.round(MULTA.reparto * 100)}% de la multa va al vendedor como compensación. El resto cubre el
          costo operativo de relanzar el lote y gestionar el caso.
        </p>

        <div className="border border-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-2.5"><p className={S.label}>Calcula la multa</p></div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Campo label="Precio adjudicado">
              <input type="number" value={c.precio} onChange={(e) => set("precio", Number(e.target.value))} className={`${S.input} ${S.mono}`} />
            </Campo>
            <Campo label="Días que el lote estuvo publicado">
              <input type="number" value={c.dias} onChange={(e) => set("dias", Number(e.target.value))} className={`${S.input} ${S.mono}`} />
            </Campo>
            <Campo label="Extras pagados por el vendedor">
              <select value={c.extras} onChange={(e) => set("extras", Number(e.target.value))} className={S.input}>
                <option value={0}>Ninguno</option>
                <option value={2990}>Precio de reserva · {clp(2990)}</option>
                <option value={3990}>Destacado en portada · {clp(3990)}</option>
                <option value={6980}>Reserva y destacado · {clp(6980)}</option>
              </select>
            </Campo>
            <Campo label="Falta">
              <select value={c.falta} onChange={(e) => set("falta", Number(e.target.value))} className={S.input}>
                {FALTAS.map(([t, mult], i) => <option key={t} value={i}>{t} · multa ×{mult}</option>)}
              </select>
            </Campo>
            <div className="sm:col-span-2">
              <button onClick={() => set("yaPago", !c.yaPago)}
                className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left text-sm ${c.yaPago ? "border-zinc-900" : "border-zinc-300"}`}>
                <span className={`flex h-4 w-4 items-center justify-center border ${c.yaPago ? "border-zinc-900 bg-zinc-900" : "border-zinc-300"}`}>
                  {c.yaPago && <Check size={11} className="text-white" />}
                </span>
                Ya había pagado y hay que revertir la transacción
              </button>
            </div>
          </div>
          <div className="border-t border-zinc-200 p-4">
            <div className="space-y-1.5">
              <Linea k={`Parte proporcional (${Math.round(MULTA.base * 100)}%, tope ${clp(MULTA.tope)})`} v={clp(m.proporcional)} />
              <Linea k={`Tiempo bloqueado (${c.dias} días × ${clp(MULTA.porDia)})`} v={clp(m.tiempo)} />
              <Linea k="Extras que el vendedor ya gastó" v={clp(m.extras)} />
              {c.yaPago && <Linea k="Costo de revertir el pago" v={clp(m.reversa)} />}
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-zinc-200 pt-3">
              <span className="text-sm font-medium">Multa total</span>
              <span className={`text-3xl font-semibold tracking-tight ${S.mono}`}>{clp(m.total)}</span>
            </div>
            <div className="mt-3 grid gap-px bg-zinc-200 sm:grid-cols-2">
              <div className="bg-white p-3">
                <p className={`text-sm font-medium ${S.mono}`}>{clp(m.vendedor)}</p>
                <p className="text-xs text-zinc-500">Compensación al vendedor</p>
              </div>
              <div className="bg-white p-3">
                <p className={`text-sm font-medium ${S.mono}`}>{clp(m.plataforma)}</p>
                <p className="text-xs text-zinc-500">Costo de relanzar y gestionar</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-600">
              Además: {FALTAS[c.falta][2].toLowerCase()}. {FALTAS[c.falta][3]}
            </p>
          </div>
        </div>

        <Aviso Icon={Info}>
          Ejemplo real: un reloj publicado el 1 de agosto que cierra el 7 se adjudica en {clp(340000)} con
          destacado contratado. El ganador no paga. La multa queda en {clp(calcularMulta({ precio: 340000, dias: 6, extras: 3990, yaPago: false, falta: 0 }).total)},
          el vendedor recibe {clp(calcularMulta({ precio: 340000, dias: 6, extras: 3990, yaPago: false, falta: 0 }).vendedor)} y
          el lote pasa al segundo postor sin volver a publicarse.
        </Aviso>
      </Bloque>

      <Bloque n="03" titulo="Escala de sanciones">
        <Tabla cabeceras={["Falta", "Multiplicador", "Suspensión"]}
          filas={FALTAS.map(([t, mult, susp]) => [t, "×" + mult, susp])} />
        <p>
          Las faltas prescriben a los 12 meses sin incidentes. Pagar la multa no borra la suspensión, y cumplir la
          suspensión no borra la multa: son cosas distintas.
        </p>
      </Bloque>

      <Bloque n="04" titulo="Si te retractas después de pagar">
        <p>
          Acá el dinero ya está en custodia, así que nadie perdió plata todavía. Lo que cambia es quién decide y
          quién paga el flete de vuelta.
        </p>
        <Tabla cabeceras={["Situación", "Quién decide", "Qué recuperas", "Costo para ti"]} filas={[
          ["Aún no despachan · vendedor empresa", "Automático", "Todo", "Nada"],
          ["Aún no despachan · vendedor particular", "El vendedor", "Todo si acepta", "5% si ya lo preparó"],
          ["Ya despachado · empresa, dentro de 10 días", "Retracto legal, si la oferta no lo excluyó", "El valor del lote", "Flete de vuelta lo paga el vendedor"],
          ["Ya despachado · particular", "No hay retracto", "Solo si no corresponde a lo publicado", "Flete de vuelta"],
          ["Ya lo recibiste y lo usaste", "Solo garantía por fallas", "Según el caso", "Peritaje si hay discusión"],
        ]} />
        <p>
          Arrepentirse no es lo mismo que reclamar. Si el lote llegó distinto a lo publicado, eso no es retracto:
          es un reclamo y no tiene costo para ti.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={() => abrir(ir, "ayuda/reclamo")} className={S.btnGhost}>Abrir un reclamo</button>
          <button onClick={() => abrir(ir, "legal/ley-19496")} className={S.btnGhost}>Cuándo aplica el retracto legal</button>
        </div>
      </Bloque>

      <Bloque n="05" titulo="Pujas falsas">
        <p>
          Pujar sin intención de pagar, para inflar el precio a un amigo o para arruinarle el remate a alguien,
          es la falta más grave del sitio. No hay tres avisos: se anula la puja, el precio vuelve al último valor
          legítimo y la cuenta queda cerrada.
        </p>
        <p>Para que eso pase pocas veces, pujar exige más respaldo mientras más caro es el lote:</p>
        <Tabla cabeceras={["Nivel", "Puedes pujar", "Qué se te pide"]} filas={NIVELES_PUJA} />
        <p className="text-xs text-zinc-500">
          La garantía retenida no es un cobro: es una retención que el banco libera sola dentro de 7 días si no
          ganas, o que se descuenta del total si ganas y pagas.
        </p>
      </Bloque>

      <Bloque n="06" titulo="Cómo detectamos cuentas coordinadas">
        <ul className="space-y-2">
          {["Cuentas distintas que pujan siempre en los lotes del mismo vendedor y nunca ganan.",
            "Coincidencia de dispositivo, red o cuenta bancaria entre postor y vendedor.",
            "Cuentas creadas el mismo día del cierre que suben el precio y después no pagan.",
            "Retiros de puja repetidos dentro de los 60 segundos permitidos.",
            "Adjudicaciones seguidas de no pago en lotes del mismo vendedor."].map((x) => (
            <li key={x} className="flex gap-2"><Eye size={15} className="mt-0.5 shrink-0 text-zinc-400" />{x}</li>
          ))}
        </ul>
        <p>
          Cuando el que infla el precio es el propio vendedor, el que paga es él: se anula el remate, pierde la
          comisión, se le cobra un 15% del sobreprecio inflado y el mejor postor real puede llevarse el lote a su
          precio. Los compradores afectados no pagan nada.
        </p>
        <button onClick={() => abrir(ir, "vender/reglas")} className={`${S.btnGhost} mt-1`}>Ver las reglas del vendedor</button>
      </Bloque>
    </div>
  );
}

/* ============================================================
   VENDER · Reglas del vendedor
   ============================================================ */
function ReglasVendedor({ ir }) {
  const [titulo, setTitulo] = useState("");
  const [fotos, setFotos] = useState(0);
  const [desc, setDesc] = useState("");
  const [fallas, setFallas] = useState(false);
  const q = calidad({ titulo, fotos, desc, fallas });

  return (
    <div>
      <Bloque n="01" titulo="Mínimos para publicar">
        <p>
          Una publicación mala no es solo fea: hace perder el tiempo a todo el mundo y termina en reclamo. Por eso
          hay un piso que el formulario no deja saltarse.
        </p>
        <Tabla cabeceras={["Requisito", "Mínimo"]} filas={[
          ["Identidad verificada", "Obligatoria antes del primer lote"],
          ["Fotos del lote real", "3, tomadas por ti"],
          ["Descripción", "120 caracteres"],
          ["Declaración de fallas conocidas", "Casilla obligatoria"],
          ["Categoría y estado", "Correctos, se revisan"],
          ["Cuenta bancaria a tu nombre", "Obligatoria para cobrar"],
        ]} />

        <div className="border border-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-2.5"><p className={S.label}>Prueba el medidor de calidad</p></div>
          <div className="space-y-4 p-4">
            <Campo label="Título">
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
                placeholder="Reloj Seiko 5 SNK809 automático 37mm" className={S.input} />
            </Campo>
            <Campo label="Descripción">
              <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="Cuenta el estado real, el uso que tuvo y qué incluye." className={S.input} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label={`Fotos cargadas · ${fotos}`}>
                <div className="flex gap-2">
                  <button onClick={() => setFotos(Math.max(0, fotos - 1))} className={`${S.btnGhost} px-3 py-2`}><Minus size={14} /></button>
                  <button onClick={() => setFotos(Math.min(8, fotos + 1))} className={`${S.btnGhost} flex-1 px-3 py-2`}><Upload size={14} /> Agregar foto</button>
                </div>
              </Campo>
              <Campo label="Fallas">
                <button onClick={() => setFallas(!fallas)}
                  className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left text-sm ${fallas ? "border-zinc-900" : "border-zinc-300"}`}>
                  <span className={`flex h-4 w-4 items-center justify-center border ${fallas ? "border-zinc-900 bg-zinc-900" : "border-zinc-300"}`}>
                    {fallas && <Check size={11} className="text-white" />}
                  </span>
                  Declaré las fallas conocidas
                </button>
              </Campo>
            </div>
            <Medidor q={q} />
          </div>
        </div>
      </Bloque>

      <Bloque n="02" titulo="Qué no se puede publicar">
        <div className="grid gap-px bg-zinc-200 sm:grid-cols-2">
          <div className="bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-500"><X size={15} /> Prohibido</p>
            <ul className="mt-2 space-y-1.5 text-xs text-zinc-600">
              <li>Armas, municiones y réplicas funcionales</li>
              <li>Fármacos, suplementos sin registro y sustancias controladas</li>
              <li>Réplicas, falsificaciones y software sin licencia</li>
              <li>Documentos de identidad, licencias y certificados</li>
              <li>Especies protegidas y productos derivados</li>
              <li>Bienes sin respaldo de dominio cuando la ley lo exige</li>
              <li>Datos personales, bases de contactos y cuentas de terceros</li>
            </ul>
          </div>
          <div className="bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-500"><AlertCircle size={15} /> Se baja por forma</p>
            <ul className="mt-2 space-y-1.5 text-xs text-zinc-600">
              <li>Fotos sacadas de internet o del catálogo del fabricante</li>
              <li>Título con palabras clave que no tienen que ver con el lote</li>
              <li>Precio de partida irreal para atraer clics</li>
              <li>Datos de contacto para cerrar la venta por fuera</li>
              <li>Un lote publicado dos veces al mismo tiempo</li>
              <li>Categoría equivocada para aparecer en más búsquedas</li>
            </ul>
          </div>
        </div>
      </Bloque>

      <Bloque n="03" titulo="Límites mientras construyes reputación">
        <Tabla cabeceras={["Situación de la cuenta", "Puedes tener abierto", "Tope por lote"]} filas={[
          ["Cuenta nueva sin ventas", "3 lotes", clp(500000)],
          ["Con 1 venta calificada", "10 lotes", clp(2000000)],
          ["Con 5 ventas calificadas", "50 lotes", "Sin tope"],
          ["Cuenta de empresa verificada", "Sin límite", "Sin tope"],
        ]} />
        <p>
          Sobre esos topes puedes publicar igual dejando una garantía del 5% del precio de partida, que se
          devuelve cuando la venta se completa sin reclamos.
        </p>
      </Bloque>

      <Bloque n="04" titulo="Lo que se mide de ti">
        <div className="grid gap-px bg-zinc-200 sm:grid-cols-4">
          {[["Despacho a tiempo", "≥ 95%"], ["Reclamos", "≤ 3%"], ["Lotes no entregados", "0"], ["Calificación", "≥ 90%"]].map(([k, v]) => (
            <div key={k} className="bg-white p-4">
              <p className={`text-lg font-medium ${S.mono}`}>{v}</p>
              <p className="mt-1 text-xs text-zinc-500">{k}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Estos números se muestran en tu perfil público. Bajo el mínimo, tus lotes dejan de aparecer en portada y
          en los primeros resultados.
        </p>
      </Bloque>

      <Bloque n="05" titulo="Sanciones">
        <Tabla cabeceras={["Conducta", "Consecuencia"]} filas={[
          ["Publicación incompleta o con fotos ajenas", "Se baja el lote, puedes corregir y republicar"],
          ["No declarar una falla conocida", "Reclamo a tu costo y advertencia"],
          ["No despachar dentro del plazo", "Retención del pago 15 días y baja de posición"],
          ["Cerrar ventas fuera de la plataforma", "Suspensión 30 días"],
          ["Pujar en tus propios lotes o coordinar cuentas", "Cierre de cuenta, pérdida de la comisión y 15% del sobreprecio"],
          ["Publicar bienes prohibidos", "Cierre inmediato y reporte a la autoridad"],
        ]} />
        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={() => ir("vender")} className={S.btn}>Publicar un lote</button>
          <button onClick={() => abrir(ir, "legal/responsabilidad")} className={S.btnGhost}>Declaración de responsabilidad</button>
        </div>
      </Bloque>
    </div>
  );
}

/* medidor de calidad de una publicación, compartido con el asistente de venta */
const calidad = ({ titulo, fotos, desc, fallas }) => {
  const puntos =
    (titulo.trim().length >= 25 ? 20 : titulo.trim().length >= 10 ? 10 : 0) +
    (fotos >= 3 ? 30 : fotos * 8) +
    (fotos > 3 ? Math.min(10, (fotos - 3) * 5) : 0) +
    (desc.trim().length >= 240 ? 25 : desc.trim().length >= 120 ? 18 : Math.round(desc.trim().length / 12)) +
    (fallas ? 15 : 0);
  const total = Math.min(100, puntos);
  const nivel = total >= 85 ? "Excelente" : total >= 65 ? "Buena" : total >= 45 ? "Aceptable" : "Insuficiente";
  const faltantes = [];
  if (fotos < 3) faltantes.push(`Faltan ${3 - fotos} fotos`);
  if (desc.trim().length < 120) faltantes.push(`Faltan ${120 - desc.trim().length} caracteres de descripción`);
  if (!fallas) faltantes.push("Falta declarar las fallas conocidas");
  if (titulo.trim().length < 10) faltantes.push("El título es muy corto");
  return { total, nivel, faltantes, publicable: faltantes.length === 0 };
};

function Medidor({ q }) {
  return (
    <div className="border-t border-zinc-200 pt-4">
      <div className="flex items-baseline justify-between">
        <p className={S.label}>Calidad de la publicación</p>
        <p className={`text-sm font-medium ${S.mono} ${q.publicable ? "" : "text-red-600"}`}>{q.total}/100 · {q.nivel}</p>
      </div>
      <div className="mt-2 h-1.5 w-full bg-zinc-100">
        <div className={`h-1.5 transition-all ${q.publicable ? "bg-zinc-900" : "bg-red-500"}`} style={{ width: q.total + "%" }} />
      </div>
      {q.faltantes.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {q.faltantes.map((x) => (
            <li key={x} className="flex items-center gap-2 text-xs text-red-600"><AlertCircle size={12} />{x}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 size={12} /> Cumple los mínimos para publicar.</p>
      )}
    </div>
  );
}

/* ============================================================
   VENDER · Difundir el lote gratis
   ============================================================ */
function Difundir({ ir, avisar, lotes }) {
  const [sel, setSel] = useState(lotes[0]?.id ?? 42);
  const l = lotes.find((x) => x.id === sel) || lotes[0];
  const enlace = "https://rematoonline.cl/lote/" + String(l.id).padStart(4, "0");
  const texto = `${l.titulo} — va en ${clp(l.precio || l.compraYa)} y cierra pronto. ${enlace}`;
  const [copiado, setCopiado] = useState("");

  const copiar = (t, etiqueta) => {
    try { navigator.clipboard && navigator.clipboard.writeText(t); } catch (e) { /* el usuario copia a mano */ }
    setCopiado(etiqueta);
    avisar("Copiado al portapapeles.", "ok");
    setTimeout(() => setCopiado(""), 2500);
  };

  return (
    <div>
      <Bloque n="01" titulo="Cada lote tiene su propia dirección">
        <p>
          No necesitas pagar publicidad para que te vean. Cada lote vive en su propia página, indexable y con
          vista previa, así que el enlace se ve bien donde lo pegues.
        </p>
        <Campo label="Elige un lote">
          <select value={sel} onChange={(e) => setSel(Number(e.target.value))} className={S.input}>
            {lotes.slice(0, 12).map((x) => <option key={x.id} value={x.id}>{lote(x.id)} · {x.titulo}</option>)}
          </select>
        </Campo>
        <div className="border border-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-2.5"><p className={S.label}>Así se ve al compartirlo</p></div>
          <div className="flex gap-3 p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-zinc-50"><l.Icon size={26} strokeWidth={1} className="text-zinc-300" /></div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{l.titulo}</p>
              <p className={`mt-1 text-xs text-zinc-600 ${S.mono}`}>Va en {clp(l.precio || l.compraYa)} · {l.pujas.length} pujas</p>
              <p className={`mt-0.5 truncate text-xs text-zinc-400 ${S.mono}`}>rematoonline.cl</p>
            </div>
          </div>
          <div className="space-y-2 border-t border-zinc-200 p-4">
            <div className="flex gap-2">
              <input readOnly value={enlace} onFocus={(e) => e.target.select()} className={`${S.input} ${S.mono}`} />
              <button onClick={() => copiar(enlace, "enlace")} className={`${S.btn} shrink-0`}>
                {copiado === "enlace" ? <Check size={15} /> : <Share2 size={15} />} Copiar
              </button>
            </div>
            <div className="flex gap-2">
              <input readOnly value={texto} onFocus={(e) => e.target.select()} className={`${S.input}`} />
              <button onClick={() => copiar(texto, "texto")} className={`${S.btnGhost} shrink-0`}>
                {copiado === "texto" ? <Check size={15} /> : <FileText size={15} />} Con texto
              </button>
            </div>
            <button onClick={() => ir("lote", { id: l.id })} className="text-xs text-zinc-500 underline underline-offset-2">
              Ver el lote publicado
            </button>
          </div>
        </div>
      </Bloque>

      <Bloque n="02" titulo="Dónde ponerlo sin gastar">
        <div className="grid gap-px bg-zinc-200 sm:grid-cols-2">
          {[["Grupos de compraventa", "Los grupos por comuna y por rubro convierten mucho mejor que un anuncio pagado. Pega el enlace con el precio actual, no una foto suelta."],
            ["Tu estado de WhatsApp", "Sirve sobre todo el último día. Un estado a las 20:00 de un lote que cierra a las 22:00 mueve pujas reales."],
            ["Marketplace y clasificados", "Publica ahí el mismo lote apuntando al remate. Ganas el público que busca precio fijo y termina pujando."],
            ["Tu propia lista de clientes", "Si vendes seguido, un correo semanal con los lotes que cierran es lo más barato y lo que más rinde."]].map(([t, d]) => (
            <div key={t} className="bg-white p-4">
              <p className="text-sm font-medium">{t}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">{d}</p>
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque n="03" titulo="Trae a alguien y ambos ganan">
        <p>
          Si invitas a un vendedor y publica su primer lote, los dos pagan 2 puntos porcentuales menos de comisión
          en su siguiente venta. Si invitas a un comprador y gana un lote, recibes {clp(5000)} de descuento en tu
          próxima comisión.
        </p>
        <Tabla cabeceras={["Quién entra", "Qué gana quien invita", "Qué gana el invitado"]} filas={[
          ["Un vendedor que publica su primer lote", "−2 puntos de comisión", "−2 puntos en su primera venta"],
          ["Un comprador que gana un lote", clp(5000) + " en comisión", "Despacho gratis en su primera compra"],
          ["Una empresa con inventario sobre 50 lotes", clp(50000), "Tasación y fotografía en terreno"],
        ]} />
        <Aviso Icon={Info}>
          El beneficio se activa cuando la operación del invitado se completa sin reclamos. Invitarte a ti mismo
          con otra cuenta cuenta como cuenta coordinada y se sanciona igual que una puja falsa.
        </Aviso>
      </Bloque>

      <Bloque n="04" titulo="Lo que sí conviene pagar">
        <p>
          Destacar cuesta {clp(3990)} por 7 días y solo vale la pena cuando el lote ya tiene fotos buenas y
          descripción completa. Destacar una publicación mala es pagar para que más gente no la compre.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => abrir(ir, "vender/reglas")} className={S.btnGhost}>Cómo dejar la publicación lista</button>
          <button onClick={() => abrir(ir, "vender/comisiones")} className={S.btnGhost}>Ver extras y precios</button>
        </div>
      </Bloque>
    </div>
  );
}

/* ============================================================
   LEGAL · Declaración de responsabilidad
   ============================================================ */
function Responsabilidad() {
  return (
    <>
      <p className={`py-4 text-xs text-zinc-500 ${S.mono}`}>Última actualización: 1 de julio de 2026</p>
      <div className="mb-6 border border-zinc-900 p-5">
        <p className="text-sm font-medium">En una línea</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          RematoOnline SpA administra el sitio, la subasta y la custodia del dinero. No es dueña de los bienes, no
          los revisa uno por uno y no es parte de la compraventa: esa se celebra entre el vendedor y el comprador
          adjudicatario.
        </p>
      </div>
      <Legal secciones={[
        ["Naturaleza del servicio", [
          "RematoOnline SpA presta un servicio de intermediación digital: pone a disposición una plataforma donde terceros ofrecen bienes en subasta y otros terceros pujan por ellos, y administra la custodia del pago hasta la conformidad del comprador.",
          "La compraventa se perfecciona entre vendedor y comprador. RematoOnline no adquiere el dominio de los bienes rematados en ningún momento, no los almacena y no los despacha.",
        ]],
        ["De qué sí respondemos", [
          "Del funcionamiento del mecanismo de subasta: registro correcto de las pujas, aplicación del incremento mínimo, prórroga del cierre y adjudicación al mejor postor.",
          "De la custodia de los fondos hasta que se cumpla la condición de liberación, y de su devolución cuando corresponda según la política de protección al comprador.",
          "De la aplicación de las sanciones y multas publicadas en el sitio, y de la resolución de los reclamos dentro de los plazos informados.",
          "Del resguardo de los datos personales conforme a la política de privacidad y a la Ley 19.628.",
        ]],
        ["De qué no respondemos", [
          "Del estado, calidad, autenticidad, funcionamiento, procedencia o titularidad de los bienes rematados. Esa responsabilidad es exclusiva del vendedor, que declara al publicar estar facultado para disponer del bien.",
          "De la veracidad de las descripciones y fotografías cargadas por los usuarios, sin perjuicio de nuestra facultad de bajar publicaciones y de la cobertura de protección al comprador.",
          "De acuerdos, pagos o entregas realizados fuera de la plataforma. Fuera del sitio no hay custodia, no hay registro y no hay cobertura.",
          "De los tributos que graven la operación entre las partes, ni de la emisión de documentos tributarios por el bien vendido, que corresponden al vendedor.",
          "De interrupciones causadas por fuerza mayor, cortes de conectividad, fallas de proveedores de pago o de couriers, ni de retrasos de despacho imputables al vendedor o al transportista.",
        ]],
        ["Límite de responsabilidad", [
          "En cualquier caso en que se determine responsabilidad de RematoOnline SpA respecto de una operación, esta se limita al monto pagado por el comprador por esa operación, incluido el despacho.",
          "No respondemos por lucro cesante, pérdida de oportunidad comercial, daño reputacional ni perjuicios indirectos derivados del uso de la plataforma.",
          "Estas limitaciones no afectan los derechos irrenunciables que la Ley 19.496 reconoce al consumidor cuando la contraparte es un proveedor.",
        ]],
        ["Responsabilidad del vendedor", [
          "El vendedor declara y garantiza que el bien es de su propiedad o que está facultado para venderlo, que su descripción es veraz y que las fallas conocidas fueron declaradas.",
          "El vendedor mantendrá indemne a RematoOnline SpA frente a reclamos de terceros derivados de la titularidad, procedencia, autenticidad o legalidad del bien publicado.",
          "Publicar bienes de comercio prohibido, falsificaciones o bienes de origen ilícito es causal de cierre inmediato de la cuenta y de denuncia a la autoridad competente.",
        ]],
        ["Responsabilidad del comprador", [
          "Las pujas son ofertas de compra en firme. El comprador adjudicatario responde por el pago dentro del plazo y por las multas descritas en las reglas del comprador cuando no lo hace.",
          "El uso de cuentas de terceros, de cuentas coordinadas o de pujas sin intención de pagar habilita el cierre de la cuenta y el cobro de los perjuicios causados al vendedor y a la plataforma.",
        ]],
        ["Reclamos de terceros sobre contenidos", [
          "Quien estime que una publicación infringe sus derechos de propiedad intelectual, industrial o de imagen puede notificarlo a legal@rematoonline.cl acompañando los antecedentes que acrediten su titularidad.",
          "Recibida una notificación fundada, la publicación se suspende mientras se da traslado al vendedor. Si no hay respuesta dentro de 5 días hábiles, la publicación se retira definitivamente.",
        ]],
        ["Vigencia y jurisdicción", [
          "Esta declaración complementa los términos y condiciones del sitio y se entiende aceptada al crear una cuenta, publicar un lote o ingresar una puja.",
          "Se rige por la ley chilena y las controversias se someten a los tribunales ordinarios de Santiago, sin perjuicio del domicilio del consumidor cuando la ley se lo reconozca.",
        ]],
      ]} />
    </>
  );
}

/* ============================================================
   PIE
   ============================================================ */
function Footer({ ir }) {
  return (
    <footer className="border-t border-zinc-200">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="flex items-baseline">
              <span className="text-lg font-semibold tracking-tighter">remato</span>
              <span className="text-lg font-light tracking-tighter text-zinc-400">online</span>
              <span className={`ml-0.5 text-xs ${S.mono} text-zinc-400`}>.cl</span>
            </div>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-zinc-500">
              Casa de remates en línea. Liquidaciones de empresas, saldos de stock y ventas entre particulares,
              con pago retenido en custodia.
            </p>
          </div>
          {MAPA.map(([seccion, items]) => (
            <div key={seccion}>
              <p className={S.label}>{seccion}</p>
              <ul className="mt-3 space-y-2">
                {items.map(([slug, titulo]) => (
                  <li key={slug}>
                    <button onClick={() => abrir(ir, slug)} className="text-xs text-zinc-600 hover:text-zinc-900">{titulo}</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-500">
          <p>© 2026 RematoOnline SpA · Santiago, Chile</p>
          <p className={S.mono}>Pagos procesados por Webpay Plus, Flow y pasarela cripto externa · sin custodia de activos</p>
        </div>
      </div>
    </footer>
  );
}