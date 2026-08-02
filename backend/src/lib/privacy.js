// Public identity helpers.
//
// Email addresses are personal data under Chilean Ley 19.628 and they are also the
// shortest path around the platform's commission: if a bidder can read the seller's
// address (or vice versa) they can simply close the deal off-site. So the public API
// exposes a stable alias instead, and reveals the real address only to the parties
// that genuinely need it (the account owner, the counterparty of a completed sale,
// and the administrator).

// Derived from the user's UUID, so it is stable across requests without leaking
// anything: the id is already public in the API payloads.
export function publicAlias(userId) {
  if (!userId) return 'Usuario';
  const compact = String(userId).replace(/-/g, '');
  return `Usuario ${compact.slice(0, 4).toUpperCase()}`;
}

// Used where a hint of the real address is genuinely useful (the counterparty of a
// closed sale). Keeps the first and last character of the local part and the TLD only.
export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  const head = local.slice(0, 1);
  const tail = local.length > 1 ? local.slice(-1) : '';
  const domainParts = domain.split('.');
  const tld = domainParts.length > 1 ? domainParts.slice(1).join('.') : domain;
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}${tail}@***.${tld}`;
}

export const isAdmin = (viewer) => viewer?.role === 'ADMIN';
