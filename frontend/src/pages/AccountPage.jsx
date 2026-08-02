import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { paymentsApi, walletApi } from "../api/client";
import { FlowBadge } from "../components/TrustBadges";
import { useAuth } from "../auth/AuthContext";
import { ErrorState, InlineNotice, PageLoader, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { DashboardNav } from "../components/DashboardNav";
import { usePollingQuery } from "../hooks/usePollingQuery";
import { formatChileDate, formatMoney, numberFromInput } from "../utils/format";

const ENTRY_LABELS = {
  deposit: "Aumento de saldo",
  withdrawal: "Retiro",
  bid_hold: "Dinero congelado",
  bid_release: "Dinero liberado",
  bid_penalty: "Penalización por rechazo",
  penalty_received: "Penalización recibida",
  purchase: "Pago de compra",
  sale_proceeds: "Ingreso por venta",
  match_payment: "Pago de compra",
  sale_income: "Ingreso por venta",
  platform_fee: "Comisión de plataforma",
  rejection_penalty: "Penalización por rechazo",
};

export function AccountPage() {
  const { user } = useAuth();
  const canTrade = user?.role === "user";
  const { showToast } = useToast();
  const fetchAccount = useCallback(async () => {
    const [wallet, entries] = await Promise.all([walletApi.get(), walletApi.entries()]);
    return { wallet, entries };
  }, []);
  const { data, loading, error, reload } = usePollingQuery(fetchAccount, { interval: 15_000 });
  const [depositAmount, setDepositAmount] = useState("");
  // Con pasarela configurada el abono se hace con tarjeta; sin ella queda el abono
  // simulado de desarrollo.
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  // Los hooks van antes de cualquier return temprano: React exige el mismo orden de
  // hooks en cada render.
  useEffect(() => {
    let cancelled = false;
    paymentsApi
      .mine()
      .then((result) => !cancelled && setGatewayEnabled(result.enabled))
      .catch(() => !cancelled && setGatewayEnabled(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Resultado del retorno desde la pasarela. El saldo ya fue (o no) acreditado por la
  // confirmación servidor a servidor: aquí sólo se informa y se recarga.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("pago");
    if (!outcome) return;
    const messages = {
      exito: "Pago confirmado. Tu saldo ya está acreditado.",
      pending: "Tu pago está pendiente de confirmación. Se acreditará en cuanto la pasarela lo confirme.",
      pendiente: "Tu pago está pendiente de confirmación. Se acreditará en cuanto la pasarela lo confirme.",
      rejected: "El pago fue rechazado. No se descontó nada.",
      cancelled: "El pago fue cancelado.",
      amount_mismatch: "El monto informado por la pasarela no coincide con la orden. Contáctanos.",
    };
    showToast(messages[outcome] ?? "No pudimos determinar el resultado del pago.");
    // Se limpia la URL para que recargar no repita el aviso.
    window.history.replaceState({}, "", window.location.pathname);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <PageLoader label="Abriendo tu cuenta" />;
  if (error && !data) return <div className="container page-space"><ErrorState title="No pudimos cargar tu saldo" error={error} onRetry={reload} /></div>;

  const wallet = data?.wallet || { available: 0, frozen: 0, total: 0 };
  const entries = data?.entries || [];

  const moveMoney = async (type) => {
    const raw = type === "deposit" ? depositAmount : withdrawAmount;
    const amount = numberFromInput(raw);
    setActionError("");
    if (amount <= 0) {
      setActionError("Ingresa un monto mayor a $0.");
      return;
    }
    if (type === "withdraw" && amount > wallet.available) {
      setActionError("Solo puedes retirar dinero de tu saldo disponible.");
      return;
    }
    setBusyAction(type);
    try {
      if (type === "deposit") {
        if (gatewayEnabled) {
          // Se sale del sitio hacia la pasarela. Al volver, el saldo ya estará
          // acreditado por la confirmación servidor a servidor.
          const started = await paymentsApi.startDeposit(amount);
          window.location.assign(started.redirectUrl);
          return;
        }
        await walletApi.deposit(amount);
      } else await walletApi.withdraw(amount);
      setDepositAmount("");
      setWithdrawAmount("");
      await reload();
      showToast(type === "deposit" ? `Agregaste ${formatMoney(amount)} a tu saldo.` : `Retiraste ${formatMoney(amount)} de tu saldo.`);
    } catch (nextError) {
      setActionError(nextError.message);
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="dashboard page-space">
      <div className="container">
        <header className="dashboard__header">
          <div>
            <span className="eyebrow">Mi cuenta</span>
            <h1>{user?.email}</h1>
            <p>Cuenta creada el {formatChileDate(user?.createdAt, { hour: undefined, minute: undefined })} · {user?.salesCount || 0} ventas concretadas</p>
          </div>
          {canTrade && <Link className="button button--red" to="/publicar">Nueva subasta</Link>}
        </header>

        <DashboardNav />

        <section className="balance-grid">
          <article className="balance-card balance-card--primary">
            <span>Saldo disponible</span>
            <strong>{formatMoney(wallet.available)}</strong>
            <p>Este dinero se puede pujar o retirar.</p>
          </article>
          <article className="balance-card">
            <span>Saldo congelado</span>
            <strong>{formatMoney(wallet.frozen)}</strong>
            <p>Comprometido en tus pujas activas.</p>
          </article>
          <article className="balance-card">
            <span>Saldo total</span>
            <strong>{formatMoney(wallet.total)}</strong>
            <p>Disponible + congelado.</p>
          </article>
        </section>

        {actionError && <InlineNotice type="error">{actionError}</InlineNotice>}

        <section className="money-actions">
          <article>
            <span className="eyebrow">Simulación confiada</span>
            <h2>Incrementar saldo</h2>
            <p>En este MVP declaras el monto. El movimiento queda registrado en backend.</p>
            <div className="money-action__form">
              <div className="money-input"><span>$</span><input aria-label="Monto a incrementar" inputMode="numeric" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="100000" /></div>
              {gatewayEnabled && <FlowBadge compact />}
              <button className="button button--dark" type="button" disabled={Boolean(busyAction)} onClick={() => moveMoney("deposit")}>
                {busyAction === "deposit" && <Spinner small />} {gatewayEnabled ? "Pagar con tarjeta" : "Agregar"}
              </button>
            </div>
          </article>
          <article>
            <span className="eyebrow">Disponible</span>
            <h2>Retirar saldo</h2>
            <p>Solo puedes retirar fondos disponibles; nunca dinero congelado.</p>
            <div className="money-action__form">
              <div className="money-input"><span>$</span><input aria-label="Monto a retirar" inputMode="numeric" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="50000" /></div>
              <button className="button button--ghost" type="button" disabled={Boolean(busyAction)} onClick={() => moveMoney("withdraw")}>
                {busyAction === "withdraw" && <Spinner small />} Retirar
              </button>
            </div>
          </article>
        </section>

        <section className="ledger">
          <div className="section-heading section-heading--compact">
            <div><span className="eyebrow">Backend auditable</span><h2>Movimientos</h2></div>
            <span>{entries.length} registros</span>
          </div>
          {entries.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Movimiento</th><th>Detalle</th><th>Disponible</th><th>Congelado</th></tr></thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatChileDate(entry.createdAt)}</td>
                      <td><span className="ledger-type">{ENTRY_LABELS[entry.type] || entry.type}</span></td>
                      <td>{entry.description}</td>
                      <td className={entry.availableDelta < 0 ? "amount-negative" : entry.availableDelta > 0 ? "amount-positive" : ""}>
                        {entry.availableDelta > 0 ? "+" : ""}{formatMoney(entry.availableDelta)}
                      </td>
                      <td className={entry.frozenDelta < 0 ? "amount-negative" : entry.frozenDelta > 0 ? "amount-positive" : ""}>
                        {entry.frozenDelta > 0 ? "+" : ""}{formatMoney(entry.frozenDelta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="history-empty"><strong>Aún no hay movimientos.</strong><p>Los depósitos, retiros, pujas y ventas aparecerán aquí.</p></div>
          )}
        </section>
      </div>
    </div>
  );
}
