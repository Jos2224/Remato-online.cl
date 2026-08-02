const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
const TOKEN_KEY = "rematoonline.token";

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Global handling for an expired or revoked session.
//
// Previously a 401 was only acted on during start-up, so once a token expired mid-session
// the user kept seeing a logged-in shell while every request failed. Any 401 now clears
// the stored token and notifies the app so it can send the user to the login screen.
const unauthorizedListeners = new Set();

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function handleUnauthorized() {
  storeToken(null);
  for (const listener of unauthorizedListeners) {
    try {
      listener();
    } catch {
      /* a broken listener must not mask the original request error */
    }
  }
}

async function request(path, options = {}) {
  const { body, rawBody, token = getStoredToken(), headers, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(rawBody !== undefined ? { body: rawBody } : body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = response.status === 204 ? null : isJson ? await response.json() : await response.text();

  if (!response.ok) {
    // Only a genuine session failure logs out. A 401 from the login endpoint itself just
    // means "wrong password" and must not wipe an unrelated session.
    if (response.status === 401 && token && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
      handleUnauthorized();
    }
    const message =
      payload?.message || payload?.error?.message || (typeof payload?.error === "string" && payload.error) ||
      (typeof payload === "string" && payload) || "No pudimos completar la solicitud.";
    throw new ApiError(
      message,
      response.status,
      payload?.error?.details || payload?.details || payload?.errors || null,
    );
  }

  return payload;
}

function unwrap(payload, keys = []) {
  if (payload == null) return payload;
  let value = payload.data ?? payload;
  for (const key of keys) {
    if (value?.[key] !== undefined) return value[key];
  }
  return value;
}

function asNumber(...values) {
  const found = values.find((value) => value !== undefined && value !== null && value !== "");
  const number = Number(found ?? 0);
  return Number.isFinite(number) ? number : 0;
}

// The public API returns an alias instead of an email for everyone except the viewer
// themselves, so every screen renders `displayName` and never assumes an address exists.
export function normalizeUser(raw = {}) {
  const user = raw.user ?? raw;
  const email = user.email ?? "";
  const alias = user.alias ?? "";
  return {
    ...user,
    id: String(user.id ?? user._id ?? ""),
    email,
    alias,
    displayName: email || alias || "Cuenta no disponible",
    role: String(user.role ?? "user").toLowerCase(),
    createdAt: user.createdAt ?? user.created_at ?? null,
    salesCount: asNumber(user.salesCount, user.sales, user.completedSales),
  };
}

export function normalizeBid(raw = {}) {
  const bidder = raw.bidder ?? raw.user ?? {};
  const status = String(raw.status ?? "active").toLowerCase();
  const email = raw.email ?? raw.bidderEmail ?? bidder.email ?? "";
  const alias = bidder.alias ?? raw.bidderAlias ?? "";
  return {
    ...raw,
    id: String(raw.id ?? raw._id ?? ""),
    email,
    alias,
    isMine: Boolean(bidder.isMe ?? raw.isMine),
    displayName: (bidder.isMe ? "Tu puja" : "") || email || alias || "Cuenta no disponible",
    userId: String(raw.userId ?? raw.bidderId ?? bidder.id ?? ""),
    amount: asNumber(raw.amount, raw.monto, raw.value),
    createdAt: raw.createdAt ?? raw.placedAt ?? raw.fecha ?? null,
    active: raw.active ?? !["withdrawn", "replaced"].includes(status),
    status,
  };
}

function normalizeStatus(raw, endsAt) {
  const source = String(raw ?? "").toLowerCase().replace(/[- ]/g, "_");
  const map = {
    open: "active",
    activa: "active",
    closed: "matching",
    ended: "matching",
    pending_match: "matching",
    in_match: "matching",
    posta: "matching",
    matched: "sold",
    completed: "sold",
    sold: "sold",
    vendida: "sold",
    expired: "no_match",
    dead: "no_match",
    failed: "no_match",
    no_match: "no_match",
  };
  if (map[source]) return map[source];
  if (source === "active") return "active";
  return endsAt && new Date(endsAt).getTime() > Date.now() ? "active" : "matching";
}

export function normalizeAuction(raw = {}) {
  const seller = raw.seller ?? raw.creator ?? raw.owner ?? raw.user ?? {};
  const endsAt = raw.endsAt ?? raw.endAt ?? raw.closesAt ?? raw.endDate ?? raw.fechaCierre ?? null;
  const bidsSource = raw.bids ?? raw.pujas ?? [];
  const bids = Array.isArray(bidsSource) ? bidsSource.map(normalizeBid) : [];
  const myBid = raw.myBid ? normalizeBid(raw.myBid) : null;
  return {
    ...raw,
    id: String(raw.id ?? raw._id ?? ""),
    title: raw.title ?? raw.titulo ?? "Subasta sin título",
    description: raw.description ?? raw.descripcion ?? "",
    category: raw.category ?? raw.categoria ?? "Otros",
    condition: raw.condition ?? raw.productCondition ?? raw.estadoProducto ?? raw.itemCondition ?? "No informado",
    startingPrice: asNumber(raw.startingPrice, raw.initialPrice, raw.precioInicial),
    currentPrice: asNumber(raw.currentPrice, raw.highestBid, raw.precioActual, raw.startingPrice, raw.initialPrice),
    commune: raw.commune ?? raw.comuna ?? raw.location ?? "No informada",
    imageUrl: raw.imageUrl ?? null,
    images: Array.isArray(raw.images)
      ? raw.images.filter((image) => image?.url).map((image) => ({ id: String(image.id ?? image.url), url: image.url }))
      : [],
    delivery: raw.delivery ?? raw.entrega ?? raw.deliveryMethod ?? "A coordinar con el vendedor",
    endsAt,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    seller: normalizeUser({ ...seller, email: seller.email ?? raw.sellerEmail ?? "", alias: seller.alias ?? "" }),
    sellerId: String(raw.sellerId ?? raw.creatorId ?? seller.id ?? seller._id ?? ""),
    bids,
    bidCount: asNumber(raw.bidCount, raw.bidsCount, bids.length),
    status: normalizeStatus(raw.status, endsAt),
    winningEmail: raw.winningEmail ?? raw.winningBidderEmail ?? raw.buyer?.email ?? raw.winner?.email ?? null,
    winningAlias: raw.winningBidderAlias ?? null,
    winningBidderId: raw.winningBidderId ?? null,
    canEdit: raw.canEdit == null ? null : Boolean(raw.canEdit),
    myBid,
    capabilities: raw.capabilities ?? { canBid: Boolean(raw.canBid), canEdit: Boolean(raw.canEdit) },
    match: raw.match ?? raw.currentMatch ?? null,
  };
}

export function normalizeWallet(raw = {}) {
  const wallet = raw.wallet ?? raw;
  const available = asNumber(wallet.available, wallet.availableBalance, wallet.balance, wallet.saldoDisponible);
  const frozen = asNumber(wallet.frozen, wallet.frozenBalance, wallet.locked, wallet.saldoCongelado);
  return {
    ...wallet,
    available,
    frozen,
    total: asNumber(wallet.total, wallet.totalBalance, available + frozen),
  };
}

export function normalizeEntry(raw = {}) {
  const availableDelta = asNumber(raw.availableDelta, raw.amount, raw.monto);
  const frozenDelta = asNumber(raw.frozenDelta);
  return {
    ...raw,
    id: String(raw.id ?? raw._id ?? `${raw.createdAt}-${raw.amount}`),
    type: String(raw.type ?? raw.kind ?? "movement").toLowerCase(),
    amount: raw.amount != null || raw.monto != null ? asNumber(raw.amount, raw.monto) : availableDelta || frozenDelta,
    availableDelta,
    frozenDelta,
    balanceAfter: raw.balanceAfter == null ? null : asNumber(raw.balanceAfter),
    description: raw.description ?? raw.note ?? raw.concept ?? "Movimiento de saldo",
    createdAt: raw.createdAt ?? raw.date ?? null,
  };
}

export function normalizeMatch(raw = {}) {
  const auction = normalizeAuction(raw.auction ?? raw.item ?? {});
  return {
    ...raw,
    id: String(raw.id ?? raw._id ?? ""),
    auction,
    auctionId: String(raw.auctionId ?? auction.id ?? ""),
    amount: asNumber(raw.amount, raw.bidAmount, raw.offeredAmount, raw.bid?.amount),
    status: String(raw.status ?? "pending").toLowerCase(),
    expiresAt: raw.expiresAt ?? raw.deadline ?? raw.turnEndsAt ?? null,
    position: asNumber(raw.position, raw.queuePosition, 1),
    actionRequired: raw.actionRequired ?? raw.canRespond ?? String(raw.status ?? "pending").toLowerCase() === "pending",
  };
}

function auctionPayload(data) {
  return {
    title: data.title,
    description: data.description,
    category: data.category,
    condition: data.condition,
    ...(data.startingPrice !== undefined ? { startingPrice: data.startingPrice } : {}),
    commune: data.commune,
    delivery: data.delivery,
    endsAt: data.endsAt,
    ...(data.acceptedDocuments ? { acceptedDocuments: data.acceptedDocuments } : {}),
  };
}

function queryString(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "");
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
}

export const authApi = {
  async register(credentials) {
    const payload = await request("/auth/register", { method: "POST", body: credentials, token: null });
    return { token: payload.token ?? payload.accessToken ?? payload.data?.token, user: normalizeUser(payload.user ?? payload.data?.user) };
  },
  async login(credentials) {
    const payload = await request("/auth/login", { method: "POST", body: credentials, token: null });
    return { token: payload.token ?? payload.accessToken ?? payload.data?.token, user: normalizeUser(payload.user ?? payload.data?.user) };
  },
  async me() {
    return normalizeUser(unwrap(await request("/auth/me"), ["user"]));
  },
};

export const usersApi = {
  async get(id) {
    return normalizeUser(unwrap(await request(`/users/${encodeURIComponent(id)}`), ["user"]));
  },
};

export const auctionsApi = {
  // Kept returning a bare array so existing callers are unaffected; use listPaged when
  // the total count matters.
  async list(params) {
    return (await auctionsApi.listPaged(params)).items;
  },
  // Server-side pagination: the API already reports the true total, so the UI no longer
  // has to guess from the length of a truncated page.
  async listPaged(params = {}) {
    const raw = await request(`/auctions${queryString({ limit: 30, ...params })}`);
    const data = raw?.data ?? raw ?? {};
    const source = Array.isArray(data) ? data : data.auctions ?? data.items ?? data.results ?? [];
    const pagination = data.pagination ?? {};
    const items = (Array.isArray(source) ? source : []).map(normalizeAuction);
    return {
      items,
      total: asNumber(pagination.total, items.length),
      limit: asNumber(pagination.limit, params.limit ?? 30),
      offset: asNumber(pagination.offset, params.offset ?? 0),
    };
  },
  async get(id) {
    return normalizeAuction(unwrap(await request(`/auctions/${encodeURIComponent(id)}`), ["auction"]));
  },
  async create(data) {
    return normalizeAuction(unwrap(await request("/auctions", { method: "POST", body: auctionPayload(data) }), ["auction"]));
  },
  async update(id, data) {
    return normalizeAuction(unwrap(await request(`/auctions/${encodeURIComponent(id)}`, { method: "PATCH", body: auctionPayload(data) }), ["auction"]));
  },
  async bid(id, amount, acceptedDocuments) {
    const body = acceptedDocuments?.length ? { amount, acceptedDocuments } : { amount };
    return normalizeAuction(unwrap(await request(`/auctions/${encodeURIComponent(id)}/bids`, { method: "POST", body }), ["auction"]));
  },
  async withdrawBid(id) {
    return request(`/auctions/${encodeURIComponent(id)}/bids/mine`, { method: "DELETE" });
  },
  // Photos are sent as raw binary; the server decides the format from the file's own
  // magic bytes, so the browser-declared type is only a routing hint.
  async addImage(id, file) {
    const payload = await request(`/auctions/${encodeURIComponent(id)}/images`, {
      method: "POST",
      headers: { "Content-Type": file.type },
      rawBody: file,
    });
    return normalizeAuction(unwrap(payload, ["auction"]));
  },
  // Sequential on purpose: the server assigns each photo the next position, so parallel
  // uploads would race for the same slot and scramble the order the seller chose.
  async addImages(id, files) {
    let auction = null;
    for (const file of files) auction = await auctionsApi.addImage(id, file);
    return auction;
  },
  async removeImage(id, imageId) {
    return normalizeAuction(
      unwrap(await request(`/auctions/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`, { method: "DELETE" }), ["auction"]),
    );
  },
};

export const walletApi = {
  async get() {
    return normalizeWallet(unwrap(await request("/wallet"), ["wallet"]));
  },
  async deposit(amount) {
    return normalizeWallet(unwrap(await request("/wallet/deposit", { method: "POST", body: { amount } }), ["wallet"]));
  },
  async withdraw(amount) {
    return normalizeWallet(unwrap(await request("/wallet/withdraw", { method: "POST", body: { amount } }), ["wallet"]));
  },
  async entries() {
    const payload = unwrap(await request("/wallet/entries"), ["entries", "movements", "items"]);
    return (Array.isArray(payload) ? payload : []).map(normalizeEntry);
  },
};

export const matchesApi = {
  async mine() {
    const payload = unwrap(await request("/matches/mine"), ["matches", "items"]);
    return (Array.isArray(payload) ? payload : []).map(normalizeMatch);
  },
  async accept(id) {
    return unwrap(await request(`/matches/${encodeURIComponent(id)}/accept`, { method: "POST" }), ["auction", "match"]);
  },
  async reject(id) {
    return unwrap(await request(`/matches/${encodeURIComponent(id)}/reject`, { method: "POST" }), ["auction", "match"]);
  },
};

export const paymentsApi = {
  // Inicia el abono y devuelve la URL de la pasarela. El saldo NO sube aquí: sube
  // cuando la pasarela confirma servidor a servidor.
  async startDeposit(amount) {
    return unwrap(await request("/payments/flow/deposit", { method: "POST", body: { amount } }));
  },
  async mine() {
    const payload = unwrap(await request("/payments/mine"));
    return { payments: payload?.payments ?? [], enabled: Boolean(payload?.enabled) };
  },
};

export const legalApi = {
  async list() {
    const payload = unwrap(await request("/legal", { token: null }), ["documents"]);
    return Array.isArray(payload) ? payload : [];
  },
  async get(slug) {
    return unwrap(await request(`/legal/${encodeURIComponent(slug)}`, { token: null }), ["document"]);
  },
  // Documentos que esta persona aún no ha firmado en su versión vigente.
  async pending(context) {
    const payload = unwrap(await request(`/legal/pending/${encodeURIComponent(context)}`), ["pending"]);
    return Array.isArray(payload) ? payload : [];
  },
  async history() {
    const payload = unwrap(await request("/legal/me/history"), ["acceptances"]);
    return Array.isArray(payload) ? payload : [];
  },
};

export const systemApi = {
  async health() {
    return unwrap(await request("/health", { token: null }), ["health"]);
  },
};

export const apiInfo = { baseUrl: API_BASE_URL };
