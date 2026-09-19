import {
  ArrowLeft,
  ArrowRight,
  Bitcoin,
  Check,
  Copy,
  CreditCard,
  Upload,
  WalletCards,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { getCustomDirectPlan } from "@/lib/qxt-data";
import {
  approveOrderForAdmin,
  createAdminBroker,
  createAdminPaymentMethod,
  createAdminPlan,
  createOrUpdateCheckoutOrder,
  deleteAdminBroker,
  deleteAdminPaymentMethod,
  deleteAdminPlan,
  getActiveBrokersWithCache,
  getActivePaymentMethods,
  getAdminBrokers,
  getAdminPaymentMethods,
  getAdminPlans,
  getAdminSummary,
  getAllOrdersForAdmin,
  getCurrentUser,
  getFundedAccountForOrder,
  getOrderById,
  getCachedOrdersForUser,
  getOrdersForUserWithCache,
  getPaymentMethodById,
  getPlanByIdWithCache,
  getUsersForAdmin,
  loginUser,
  rejectOrderForAdmin,
  submitPaymentForOrder,
  updateAdminBroker,
  updateAdminPaymentMethod,
  updateAdminPlan,
  type BrokerRecord,
  type OrderRecord,
  type PaymentMethod,
  type PlanRecord,
  type PublicUser,
} from "@/lib/backend";
import { Layout, SyncNotice } from "./QxtSite";

const apiOrigin = "";
function normalizeRouteValue(value: string | number | undefined | null) {
  return String(value ?? "").replace(/^['"]+|['"]+$/g, "");
}
function queryValue(name: string) {
  const value =
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get(name) ||
    "";
  return normalizeRouteValue(value);
}
function statusLabel(status: string) {
  if (status === "pending_verification") return "Pending Verification";
  if (status === "approved" || status === "active") return "Approved";
  if (status === "rejected" || status === "payment_rejected") return "Rejected";
  return status;
}
function buildSuggestedAccountPassword(orderId: string, email: string) {
  const seed = (email.split("@")[0] || "QXT").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "QXT";
  const suffix = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(-6) || "ACCOUNT";
  return `${seed.toUpperCase()}-${suffix}!`;
}
function useUser() {
  const { user, initializing } = useAuth();
  return { user, loading: initializing };
}
function instantPlanFields(price: string | number) {
  const calculated = getCustomDirectPlan(Number(price));
  return {
    size: calculated?.size || "",
    dailyLoss: calculated?.dailyLoss || "",
  };
}
function AuthRequired({ next }: { next: string }) {
  return (
    <Layout>
      <section className="section">
        <div className="container-x max-w-xl">
          <p className="eyebrow">Checkout</p>
          <h1 className="mt-4 text-4xl font-semibold">Sign in to continue</h1>
          <p className="mt-3 text-muted-foreground">
            Your account is required before we can save an order.
          </p>
          <Link to="/login" search={{ redirect: next }} className="btn-gold mt-7">
            Login / Sign Up <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
function AdminOnlyLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
}
function AdminAuthRequired({ next }: { next: string }) {
  return (
    <AdminOnlyLayout>
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40">
          <p className="eyebrow text-slate-400">Admin access</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Sign in to continue</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Your admin session is required to manage orders, users, and funded accounts.
          </p>
          <Link
            to="/admin-dashboard/login"
            search={{ redirect: next }}
            className="btn-gold mt-6 inline-flex"
          >
            Admin login <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </AdminOnlyLayout>
  );
}
function FlowShell({
  children,
  eyebrow,
  title,
  copy,
}: {
  children?: ReactNode;
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <Layout>
      <section className="section">
        <div className="container-x max-w-5xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold">{title}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{copy}</p>
          {children}
        </div>
      </section>
    </Layout>
  );
}
function LoadingPage() {
  return (
    <Layout>
      <section className="section">
        <div className="container-x">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </section>
    </Layout>
  );
}

function PaymentQrCode({ payload, label }: { payload: string; label: string }) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setError(false);
    QRCode.toDataURL(payload.trim(), {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 260,
    })
      .then((dataUrl) => {
        if (!cancelled) setSource(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (error || !payload.trim()) {
    return (
      <div className="mt-5 flex size-64 items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 p-5 text-center text-xs text-destructive">
        QR code unavailable. Use the deposit address to pay manually.
      </div>
    );
  }

  return source ? (
    <img className="mt-5 size-64 rounded-md bg-white p-2" src={source} alt={label} />
  ) : (
    <div className="mt-5 flex size-64 items-center justify-center rounded-md bg-white text-xs text-slate-700">
      Generating QR code...
    </div>
  );
}
function AdminLoadingPage() {
  return (
    <AdminOnlyLayout>
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-300">Loading admin workspace…</p>
      </div>
    </AdminOnlyLayout>
  );
}

export function CheckoutGatewayPage() {
  const plan = queryValue("plan") || "instant-3000";
  const { user, loading } = useUser();
  const next = `/checkout/broker?plan=${encodeURIComponent(plan)}`;
  useEffect(() => {
    if (!loading && typeof window !== "undefined")
      window.history.replaceState(
        {},
        "",
        user ? next : `/login?redirect=${encodeURIComponent(next)}`,
      );
  }, [loading, next, user]);
  if (loading) return <LoadingPage />;
  return user ? <BrokerSelectionPage /> : <AuthRequired next={next} />;
}

export function BrokerSelectionPage() {
  const { user, loading } = useUser();
  const planId = queryValue("plan");
  const [selected, setSelected] = useState("");
  const [brokers, setBrokers] = useState<BrokerRecord[]>([]);
  const [loadingBrokers, setLoadingBrokers] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const navigate = useNavigate();

  const loadBrokers = async () => {
    setLoadingBrokers(true);
    setError("");
    try {
      const result = await getActiveBrokersWithCache();
      setBrokers(result.data);
      setStale(result.source === "cache");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load brokers.");
    } finally {
      setLoadingBrokers(false);
    }
  };

  useEffect(() => {
    void loadBrokers();
  }, []);

  if (!user) return <AuthRequired next={`/checkout/broker?plan=${encodeURIComponent(planId)}`} />;

  return (
    <FlowShell
      eyebrow="Step 1 of 4"
      title="Select Your Broker"
      copy="Choose one trading environment for this order. Payment methods are selected on the next page."
    >
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loadingBrokers ? (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
            Loading brokers…
          </div>
        ) : brokers.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
            No brokers are available right now. Please try again.
          </div>
        ) : (
          brokers.map((broker) => (
            <button
              type="button"
              key={broker.id}
              onClick={() => setSelected(broker.id)}
              aria-pressed={selected === broker.id}
              className={`broker-card text-left ${selected === broker.id ? "border-gold ring-1 ring-gold" : ""}`}
            >
              <div className="flex items-center justify-between">
                <img src={broker.image} alt={broker.name} />
                {selected === broker.id ? (
                  <span className="selection-badge">
                    <Check size={13} />
                    Selected
                  </span>
                ) : (
                  <span className="active-badge">
                    <i />
                    Available
                  </span>
                )}
              </div>
              <h2 className="mt-7 text-xl font-semibold">{broker.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{broker.copy}</p>
            </button>
          ))
        )}
      </div>
      {error && <p className="mt-5 text-sm text-destructive">{error}</p>}
      {stale && <SyncNotice kind="brokers" />}
      {error && (
        <button type="button" className="btn-secondary mt-3" onClick={() => void loadBrokers()}>
          Retry
        </button>
      )}
      <div className="mt-10 flex gap-3">
        <Link to="/accounts" className="btn-secondary">
          <ArrowLeft size={15} />
          Back
        </Link>
        <button
          type="button"
          disabled={!selected}
          className="btn-gold disabled:opacity-50"
          onClick={() =>
            navigate({
              to: "/checkout/payment-method",
              search: {
                plan: normalizeRouteValue(planId),
                broker: normalizeRouteValue(selected),
              } as any,
            })
          }
        >
          Continue <ArrowRight size={15} />
        </button>
      </div>
    </FlowShell>
  );
}

export function PaymentMethodSelectionPage() {
  const { user, loading } = useUser();
  const planId = queryValue("plan");
  const brokerId = queryValue("broker");
  const [selected, setSelected] = useState("");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadMethods = async () => {
    setLoadingMethods(true);
    setError("");
    try {
      const loaded = await getActivePaymentMethods();
      setMethods(loaded);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load payment methods.");
      setMethods([]);
    } finally {
      setLoadingMethods(false);
    }
  };

  useEffect(() => {
    void loadMethods();
  }, []);

  if (loading) return <LoadingPage />;
  if (!user)
    return (
      <AuthRequired
        next={`/checkout/payment-method?plan=${encodeURIComponent(planId)}&broker=${encodeURIComponent(brokerId)}`}
      />
    );

  return (
    <FlowShell
      eyebrow="Step 2 of 4"
      title="Select Payment Method"
      copy="Choose one payment network. The deposit details will be shown on the next page."
    >
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loadingMethods ? (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
            Loading payment methods…
          </div>
        ) : methods.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
            No payment methods are available right now. Please try again.
          </div>
        ) : (
          methods.map((method) => (
            <button
              type="button"
              key={method.id}
              onClick={() => setSelected(method.id)}
              aria-pressed={selected === method.id}
              className={`broker-card text-left ${selected === method.id ? "border-gold ring-1 ring-gold" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-md border border-gold/30 bg-gold/10 text-gold">
                  {method.id === "bitcoin" ? (
                    <Bitcoin size={22} />
                  ) : method.id === "ethereum" ? (
                    <WalletCards size={22} />
                  ) : (
                    <CreditCard size={22} />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold">{method.name}</h2>
                  <p className="text-xs text-muted-foreground">{method.network}</p>
                </div>
                {selected === method.id && (
                  <Check className="ml-auto shrink-0 text-gold" size={18} />
                )}
              </div>
            </button>
          ))
        )}
      </div>
      {error && <p className="mt-5 text-sm text-destructive">{error}</p>}
      {error && (
        <button type="button" className="btn-secondary mt-3" onClick={() => void loadMethods()}>
          Retry
        </button>
      )}
      <div className="mt-10 flex gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate({ to: "/checkout/broker", search: { plan: planId } })}
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <button
          type="button"
          disabled={!selected || !brokerId}
          className="btn-gold disabled:opacity-50"
          onClick={() =>
            navigate({
              to: "/checkout/details",
              search: {
                plan: normalizeRouteValue(planId),
                broker: normalizeRouteValue(brokerId),
                method: normalizeRouteValue(selected),
              } as any,
            })
          }
        >
          Continue <ArrowRight size={15} />
        </button>
      </div>
    </FlowShell>
  );
}
export function PaymentDetailsPage() {
  const { user, loading } = useUser();
  const planId = queryValue("plan");
  const brokerId = queryValue("broker");
  const methodId = queryValue("method");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [plan, setPlan] = useState<PlanRecord | null>(null);
  const [brokers, setBrokers] = useState<BrokerRecord[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [stale, setStale] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    Promise.all([
      getPaymentMethodById(methodId),
      getPlanByIdWithCache(planId),
      getActiveBrokersWithCache(),
    ])
      .then(([paymentMethod, selectedPlan, brokerResult]) => {
        setMethod(paymentMethod);
        setPlan(selectedPlan);
        setBrokers(brokerResult.data);
        setStale(brokerResult.source === "cache");
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Unable to load payment details."),
      );
  }, [methodId, planId]);
  if (loading) return <LoadingPage />;
  if (!user)
    return (
      <AuthRequired
        next={`/checkout/details?plan=${planId}&broker=${brokerId}&method=${methodId}`}
      />
    );
  const broker = brokers.find((entry) => entry.id === brokerId);
  if (!method || !plan || !broker)
    return (
      <FlowShell
        eyebrow="Payment"
        title="Payment details unavailable"
        copy={error || "Return to the previous step and select your payment details again."}
      >
        <Link
          to="/checkout/payment-method"
          search={{ plan: planId, broker: brokerId } as any}
          className="btn-secondary mt-8"
        >
          <ArrowLeft size={15} />
          Back
        </Link>
      </FlowShell>
    );
  const copyAddress = async () => {
    await navigator.clipboard?.writeText(method.depositAddress);
    setCopied(true);
  };
  return (
    <FlowShell
      eyebrow="Step 3 of 4"
      title="Complete Your Purchase"
      copy="Send the exact amount to the deposit address below, then confirm that you have paid."
    >
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="order-card">
          <dl className="grid gap-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Selected Plan</dt>
              <dd className="font-semibold">
                {plan.size} {plan.type} Account
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Price</dt>
              <dd className="font-semibold text-gold">${plan.price} USD</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Broker</dt>
              <dd>{broker.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Payment Method</dt>
              <dd>{method.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Network</dt>
              <dd>{method.network}</dd>
            </div>
          </dl>
          <div className="mt-8 border-t border-border pt-7">
            <h2 className="text-xl font-semibold">Send Payment</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Send exactly <b className="text-foreground">${plan.price} USD</b> using{" "}
              <b className="text-foreground">{method.name}</b>.
            </p>
            <p className="mt-5 text-sm text-muted-foreground">Deposit Address</p>
            <div className="mt-2 break-all rounded-md border border-border bg-muted p-3 font-mono text-xs">
              {method.depositAddress}
            </div>
            <button type="button" className="btn-secondary mt-3" onClick={copyAddress}>
              <Copy size={15} />
              {copied ? "Copied" : "Copy Address"}
            </button>
            <p className="mt-5 rounded-md border border-gold/30 bg-gold/10 p-3 text-xs leading-5 text-gold">
              Make sure you use the correct network. Sending funds through the wrong network may
              result in loss of funds.
            </p>
            <button
              type="button"
              className="btn-gold mt-7 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={creatingOrder}
              onClick={async () => {
                if (creatingOrder) return;
                setCreatingOrder(true);
                setError("");
                try {
                  const order = await createOrUpdateCheckoutOrder({
                    planId,
                    broker: brokerId,
                    paymentMethodId: methodId,
                  });
                  navigate({
                    to: "/checkout/proof",
                    search: { order: normalizeRouteValue(order.id) } as any,
                  });
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "Unable to create order.");
                } finally {
                  setCreatingOrder(false);
                }
              }}
            >
              {creatingOrder ? "Creating order..." : "I Have Paid"} <ArrowRight size={15} />
            </button>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <div className="order-card flex flex-col items-center">
          <p className="eyebrow">Scan to pay</p>
          <PaymentQrCode
            payload={method.qrCode || method.depositAddress}
            label={`QR code for ${method.name}`}
          />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Scan the address above with your wallet app.
          </p>
        </div>
      </div>
      {stale && <SyncNotice kind="brokers" />}
    </FlowShell>
  );
}

export function PaymentProofPage() {
  const { user, loading } = useUser();
  const orderId = queryValue("order");
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    if (user && orderId)
      getOrderById(orderId)
        .then(async (loaded) => {
          setOrder(loaded);
          setMethod(await getPaymentMethodById(loaded.paymentMethodId));
        })
        .catch((caught) =>
          setError(caught instanceof Error ? caught.message : "Unable to load order."),
        );
  }, [orderId, user]);
  if (loading) return <LoadingPage />;
  if (!user) return <AuthRequired next={`/checkout/proof?order=${orderId}`} />;
  if (!order || !method)
    return (
      <FlowShell
        eyebrow="Payment proof"
        title="Order unavailable"
        copy={error || "This order could not be loaded."}
      />
    );
  const submitProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("paymentProof");
    if (!(file instanceof File) || file.size === 0) {
      setError("A payment screenshot is required.");
      return;
    }
    try {
      await submitPaymentForOrder({
        orderId: order.id,
        transactionHash: String(data.get("transactionHash") || ""),
        paymentProof: file,
      });
      navigate({ to: "/dashboard" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit payment proof.");
    }
  };
  return (
    <FlowShell
      eyebrow="Step 4 of 4"
      title="Confirm Your Payment"
      copy="Upload your payment screenshot. Your account remains inactive until manual review."
    >
      <div className="mt-10 max-w-2xl">
        <div className="order-card">
          <dl className="grid gap-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Order</dt>
              <dd className="font-mono">#{order.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Amount</dt>
              <dd>${order.amount} USD</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Broker</dt>
              <dd>{order.broker}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Payment Method</dt>
              <dd>{method.name}</dd>
            </div>
          </dl>
          <form className="mt-8 grid gap-5 border-t border-border pt-7" onSubmit={submitProof}>
            <label>
              Upload Payment Screenshot
              <input
                name="paymentProof"
                required
                type="file"
                accept="image/*,.pdf"
                className="field mt-2 p-2"
              />
            </label>
            <label>
              Transaction ID / TXID <span className="text-muted-foreground">(optional)</span>
              <input
                name="transactionHash"
                className="field mt-2"
                placeholder="Optional transaction reference"
              />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button className="btn-gold w-fit" type="submit">
              <Upload size={15} />
              Submit Payment
            </button>
          </form>
        </div>
      </div>
    </FlowShell>
  );
}

export function UserOrdersDashboardPage() {
  const { user, loading } = useUser();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [ordersStale, setOrdersStale] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<
    Record<string, { email: string; password: string }>
  >({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const ordersRequest = useRef(0);
  const ordersInFlight = useRef(false);

  const loadOrders = async () => {
    if (!user || ordersInFlight.current) return;
    ordersInFlight.current = true;
    const requestId = ++ordersRequest.current;
    setOrdersError("");
    try {
      const result = await getOrdersForUserWithCache(user.id);
      if (requestId !== ordersRequest.current) return;
      setOrders(result.data);
      setOrdersStale(result.source === "cache");
    } catch (caught) {
      if (requestId !== ordersRequest.current) return;
      setOrdersError(caught instanceof Error ? caught.message : "Unable to load your orders.");
    } finally {
      if (requestId === ordersRequest.current) {
        setOrdersLoading(false);
        ordersInFlight.current = false;
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    const cached = getCachedOrdersForUser(user.id);
    if (cached) {
      setOrders(cached.data);
      setOrdersLoading(false);
    }
    void loadOrders();
    const retry = () => void loadOrders();
    window.addEventListener("online", retry);
    const interval = window.setInterval(retry, 15000);
    return () => {
      window.removeEventListener("online", retry);
      window.clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (!orders.length) return;
    const firstOrder = orders[0];
    if (!firstOrder) return;
    const savedOrderId =
      typeof window !== "undefined" ? localStorage.getItem("qxt-selected-order") : null;
    const nextOrderId = orders.some((order) => order.id === savedOrderId)
      ? savedOrderId
      : firstOrder.id;
    setSelectedOrderId(nextOrderId);
    if (typeof window !== "undefined" && nextOrderId)
      localStorage.setItem("qxt-selected-order", nextOrderId);
  }, [orders]);

  const selectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    localStorage.setItem("qxt-selected-order", orderId);
  };

  const loadCredentials = async (orderId: string) => {
    try {
      const account = await getFundedAccountForOrder(orderId);
      if (account) {
        setCredentials((current) => ({
          ...current,
          [orderId]: { email: account.email, password: account.password },
        }));
        setRevealed((current) => ({ ...current, [orderId]: true }));
      }
    } catch {
      setCredentials((current) => ({ ...current, [orderId]: { email: "", password: "" } }));
    }
  };

  const copyValue = async (value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  if (loading) return <LoadingPage />;
  if (!user) return <AuthRequired next="/dashboard" />;

  return (
    <Layout>
      <section className="section">
        <div className="container-x">
          <p className="eyebrow">Trader dashboard</p>
          <h1 className="mt-4 text-4xl font-semibold">My Orders</h1>
          {ordersStale && <SyncNotice kind="orders" />}
          {ordersError && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-destructive">
              <span>{ordersError}</span>
              <button type="button" className="btn-secondary" onClick={() => void loadOrders()}>
                Retry
              </button>
            </div>
          )}
          <div className="mt-8 grid gap-4">
            {ordersLoading && orders.length === 0 ? (
              <div className="order-card text-muted-foreground">Loading your orders...</div>
            ) : orders.length === 0 ? (
              <div className="order-card text-muted-foreground">
                <p>No orders yet. Choose an account to get started.</p>
                <Link to="/accounts" className="btn-gold mt-5 w-fit">
                  Order Now <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              orders.map((order) => {
                const isApproved =
                  order.orderStatus === "approved" || order.orderStatus === "active";
                const account = credentials[order.id];
                const rejected =
                  order.orderStatus === "rejected" || order.orderStatus === "payment_rejected";
                const isSelected = selectedOrderId === order.id;

                return (
                  <article key={order.id} className="order-card">
                    <div className="grid gap-3 lg:grid-cols-6 lg:items-center">
                      <span className="font-mono text-xs">#{order.id}</span>
                      <span>{order.planName}</span>
                      <span>{order.broker}</span>
                      <span>{order.paymentMethodName}</span>
                      <span>${order.amount}</span>
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => selectOrder(order.id)}
                        aria-pressed={isSelected}
                      >
                        <strong className={rejected ? "text-red-400" : "text-gold"}>
                          {isSelected ? "Open account" : statusLabel(order.orderStatus)}
                        </strong>
                      </button>
                    </div>

                    {isSelected && (
                      <div className="mt-6 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
                        <p>
                          Order ID: <b>{order.id}</b>
                        </p>
                        <p>
                          Plan: <b>{order.planName}</b>
                        </p>
                        <p>
                          Broker: <b>{order.broker}</b>
                        </p>
                        <p>
                          Payment method: <b>{order.paymentMethodName}</b>
                        </p>
                        <p>
                          Amount:{" "}
                          <b>
                            ${order.amount} {order.currency}
                          </b>
                        </p>
                        <p>
                          Status: <b>{statusLabel(order.orderStatus)}</b>
                        </p>
                        <p>
                          TXID: <b>{order.transactionHash || "Not provided"}</b>
                        </p>
                        <p>
                          Updated: <b>{new Date(order.updatedAt).toLocaleString()}</b>
                        </p>

                        {rejected ? (
                          <div className="sm:col-span-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-red-200">
                            {order.rejectionReason
                              ? `Order rejected: ${order.rejectionReason}`
                              : "Order rejected. No funded account was delivered."}
                          </div>
                        ) : null}

                        {order.paymentProof ? (
                          <a
                            className="text-link sm:col-span-2"
                            href={`${apiOrigin}${order.paymentProof}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open payment proof
                          </a>
                        ) : null}

                        {isApproved ? (
                          <div className="sm:col-span-2 rounded-md border border-border bg-surface p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold">Funded Account</p>
                              {account ? (
                                <button
                                  type="button"
                                  className="btn-secondary btn-small"
                                  onClick={() =>
                                    setRevealed((current) => ({
                                      ...current,
                                      [order.id]: !current[order.id],
                                    }))
                                  }
                                >
                                  {revealed[order.id] ? "Hide Password" : "Show Password"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-gold btn-small"
                                  onClick={() => void loadCredentials(order.id)}
                                >
                                  Reveal credentials
                                </button>
                              )}
                            </div>

                            {account ? (
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <div className="rounded-md border border-border bg-background p-3">
                                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                    Email
                                  </p>
                                  <p className="mt-2 break-all font-mono text-sm">
                                    {revealed[order.id] ? account.email : "********"}
                                  </p>
                                  <div className="mt-3 flex gap-2">
                                    <button
                                      type="button"
                                      className="btn-small btn-secondary"
                                      onClick={() => void copyValue(account.email)}
                                    >
                                      Copy Email
                                    </button>
                                  </div>
                                </div>

                                <div className="rounded-md border border-border bg-background p-3">
                                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                    Password
                                  </p>
                                  <p className="mt-2 break-all font-mono text-sm">
                                    {revealed[order.id] ? account.password : "********"}
                                  </p>
                                  <div className="mt-3 flex gap-2">
                                    <button
                                      type="button"
                                      className="btn-small btn-secondary"
                                      onClick={() => void copyValue(account.password)}
                                    >
                                      Copy Password
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-3 text-sm text-muted-foreground">
                                Your approved account credentials are available once the admin
                                releases them.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { user: currentUser, initializing, setUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initializing && currentUser?.admin) navigate({ to: "/admin-dashboard" });
  }, [currentUser, initializing, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const user = await loginUser({ email: form.email.trim(), password: form.password });
      if (!user.admin || user.email.toLowerCase() !== form.email.trim().toLowerCase()) {
        throw new Error("This account is not authorized for the admin dashboard.");
      }
      setUser(user);
      navigate({ to: "/admin-dashboard" });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to sign in to the admin dashboard.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminOnlyLayout>
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.12),_transparent_35%),linear-gradient(180deg,#020617,#0f172a_40%,#111827)] px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/85 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-sm">
          <div className="mb-8">
            <p className="eyebrow text-slate-400">Admin portal</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Secure sign in</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Use your admin credentials to review payments, approve account deliveries, and manage
              customer orders.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="admin@gmail.com"
                className="field border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-200">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="admin"
                className="field border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                required
              />
            </label>
            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="btn-gold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in to dashboard"}
            </button>
          </form>
        </div>
      </div>
    </AdminOnlyLayout>
  );
}

export function AdminDashboardPage() {
  const { user, loading } = useUser();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "orders" | "plans" | "brokers" | "payment-methods" | "users"
  >("dashboard");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [brokers, setBrokers] = useState<BrokerRecord[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalSales: 0,
    pendingOrders: 0,
    approvedOrders: 0,
    rejectedOrders: 0,
    activeFundedAccounts: 0,
  });
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalForm, setApprovalForm] = useState({ accountEmail: "", accountPassword: "" });
  const [newPlan, setNewPlan] = useState({
    id: "",
    type: "Instant",
    size: "",
    price: "",
    dailyLoss: "",
    target: "",
    drawdown: "",
    description: "",
    features: "",
    active: true,
    popular: false,
  });
  const [newBroker, setNewBroker] = useState({
    id: "",
    name: "",
    image: "",
    copy: "",
    enabled: true,
  });
  const [newMethod, setNewMethod] = useState({
    id: "",
    name: "",
    network: "",
    depositAddress: "",
    instructions: "",
    enabled: true,
    minimumAmount: "",
    maximumAmount: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (newPlan.type !== "Instant") return;
    const fields = instantPlanFields(newPlan.price);
    if (fields.size === newPlan.size && fields.dailyLoss === newPlan.dailyLoss) return;
    setNewPlan((current) => ({ ...current, ...fields }));
  }, [newPlan.dailyLoss, newPlan.price, newPlan.size, newPlan.type]);

  const loadData = async () => {
    if (!user?.admin) return;
    const [
      loadedOrders,
      loadedSummary,
      loadedUsers,
      loadedPlans,
      loadedBrokers,
      loadedPaymentMethods,
    ] = await Promise.all([
      getAllOrdersForAdmin(),
      getAdminSummary(),
      getUsersForAdmin(),
      getAdminPlans(),
      getAdminBrokers(),
      getAdminPaymentMethods(),
    ]);
    setOrders(loadedOrders);
    setSummary(loadedSummary);
    setUsers(loadedUsers);
    setPlans(loadedPlans);
    setBrokers(loadedBrokers);
    setPaymentMethods(loadedPaymentMethods);
  };

  useEffect(() => {
    if (user?.admin) void loadData();
  }, [user]);

  const userById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesFilter =
          filter === "all" ||
          (filter === "pending" && order.orderStatus === "pending_verification") ||
          (filter === "approved" &&
            (order.orderStatus === "approved" || order.orderStatus === "active")) ||
          (filter === "rejected" &&
            (order.orderStatus === "rejected" || order.orderStatus === "payment_rejected"));
        if (!matchesFilter) return false;
        const haystack =
          `${order.id} ${userById.get(order.userId)?.name ?? ""} ${userById.get(order.userId)?.email ?? ""}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      }),
    [filter, orders, search, userById],
  );

  const handleReject = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    setMessage("");
    try {
      await rejectOrderForAdmin({ orderId: selectedOrder.id, reason: rejectionReason });
      setSelectedOrder(null);
      setRejectionReason("");
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to reject this order.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproval = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    setMessage("");
    try {
      await approveOrderForAdmin({
        orderId: selectedOrder.id,
        accountEmail: approvalForm.accountEmail,
        accountPassword: approvalForm.accountPassword,
      });
      setSelectedOrder(null);
      setApprovalForm({ accountEmail: "", accountPassword: "" });
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to approve this order.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickApprove = (order: OrderRecord) => {
    setSelectedOrder(order);
    setMessage("");
    const email = userById.get(order.userId)?.email || "";
    setApprovalForm({
      accountEmail: email,
      accountPassword: buildSuggestedAccountPassword(order.id, email),
    });
  };

  const handleQuickReject = async (order: OrderRecord) => {
    setSubmitting(true);
    setMessage("");
    try {
      await rejectOrderForAdmin({
        orderId: order.id,
        reason: "Rejected by admin from dashboard actions.",
      });
      if (selectedOrder?.id === order.id) setSelectedOrder(null);
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to reject this order.");
    } finally {
      setSubmitting(false);
    }
  };

  const updatePaymentMethod = async (method: PaymentMethod) => {
    setSubmitting(true);
    setMessage("");
    try {
      await updateAdminPaymentMethod({
        id: method.id,
        enabled: method.enabled,
        name: method.name,
        network: method.network,
        depositAddress: method.depositAddress,
        qrData: method.qrCode,
        instructions: method.instructions,
      });
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to update payment method.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePlan = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      const features = newPlan.features
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const payload: Parameters<typeof createAdminPlan>[0] = {
        type: newPlan.type,
        size: newPlan.size,
        price: Number(newPlan.price || 0),
        dailyLoss: newPlan.dailyLoss,
        description: newPlan.description,
        features,
        active: newPlan.active,
        popular: newPlan.popular,
      };
      if (newPlan.id) payload.id = newPlan.id;
      if (newPlan.target) payload.target = newPlan.target;
      if (newPlan.drawdown) payload.drawdown = newPlan.drawdown;
      await createAdminPlan(payload);
      setNewPlan({
        id: "",
        type: "Instant",
        size: "",
        price: "",
        dailyLoss: "",
        target: "",
        drawdown: "",
        description: "",
        features: "",
        active: true,
        popular: false,
      });
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to create plan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePlan = async (plan: PlanRecord) => {
    setSubmitting(true);
    setMessage("");
    try {
      const payload: Parameters<typeof updateAdminPlan>[0] = {
        id: plan.id,
        type: plan.type,
        size: plan.size,
        price: Number(plan.price),
        dailyLoss: plan.dailyLoss,
        description: plan.description,
        features: plan.features,
        active: plan.active,
        popular: plan.popular ?? false,
      };
      if (plan.target) payload.target = plan.target;
      if (plan.drawdown) payload.drawdown = plan.drawdown;
      await updateAdminPlan(payload);
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to update plan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    setSubmitting(true);
    setMessage("");
    try {
      await deleteAdminPlan(id);
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to delete plan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateBroker = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      const payload: Parameters<typeof createAdminBroker>[0] = {
        name: newBroker.name,
        image: newBroker.image,
        copy: newBroker.copy,
        enabled: newBroker.enabled,
      };
      if (newBroker.id) payload.id = newBroker.id;
      await createAdminBroker(payload);
      setNewBroker({ id: "", name: "", image: "", copy: "", enabled: true });
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to create broker.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBroker = async (broker: BrokerRecord) => {
    setSubmitting(true);
    setMessage("");
    try {
      await updateAdminBroker({
        id: broker.id,
        name: broker.name,
        image: broker.image,
        copy: broker.copy,
        enabled: broker.enabled,
      });
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to update broker.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBroker = async (id: string) => {
    setSubmitting(true);
    setMessage("");
    try {
      await deleteAdminBroker(id);
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to delete broker.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateMethod = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      const payload: Parameters<typeof createAdminPaymentMethod>[0] = {
        name: newMethod.name,
        network: newMethod.network,
        depositAddress: newMethod.depositAddress,
        instructions: newMethod.instructions,
        enabled: newMethod.enabled,
      };
      if (newMethod.id) payload.id = newMethod.id;
      if (newMethod.minimumAmount) payload.minimumAmount = Number(newMethod.minimumAmount);
      if (newMethod.maximumAmount) payload.maximumAmount = Number(newMethod.maximumAmount);
      await createAdminPaymentMethod(payload);
      setNewMethod({
        id: "",
        name: "",
        network: "",
        depositAddress: "",
        instructions: "",
        enabled: true,
        minimumAmount: "",
        maximumAmount: "",
      });
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to add payment method.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMethod = async (id: string) => {
    setSubmitting(true);
    setMessage("");
    try {
      await deleteAdminPaymentMethod(id);
      await loadData();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to delete payment method.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <AdminLoadingPage />;
  if (!user?.admin) return <AdminAuthRequired next="/admin-dashboard" />;

  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "orders", label: "Orders" },
    { key: "plans", label: "Plans" },
    { key: "brokers", label: "Brokers" },
    { key: "payment-methods", label: "Payment Methods" },
    { key: "users", label: "Users" },
  ] as const;

  return (
    <AdminOnlyLayout>
      <div className="min-h-screen bg-slate-950">
        <div className="mx-auto max-w-[1600px] px-4 py-8 lg:px-6">
          <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded-3xl border border-border bg-surface p-5 shadow-[0_18px_48px_rgba(0,0,0,0.15)]">
              <div className="mb-6">
                <p className="eyebrow">Admin</p>
                <h1 className="mt-2 text-2xl font-semibold text-foreground">Operations</h1>
              </div>

              <nav className="grid gap-2 text-sm">
                {tabs.map((tab) => (
                  <button
                    type="button"
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-xl px-3 py-2 text-left transition-colors ${activeTab === tab.key ? "bg-gold/10 text-gold ring-1 ring-gold/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="mt-8 rounded-2xl border border-border bg-background p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Security
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Only authenticated admins can access this dashboard and the customer-funded
                  account data.
                </p>
              </div>
            </aside>

            <main className="rounded-3xl border border-border bg-surface p-5 shadow-[0_18px_48px_rgba(0,0,0,0.12)]">
              {message ? (
                <div className="mb-5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  {message}
                </div>
              ) : null}

              {activeTab === "dashboard" && (
                <>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="eyebrow">Overview</p>
                      <h2 className="mt-2 text-3xl font-semibold text-foreground">
                        Admin Dashboard
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setFilter("all")}
                        className={`btn-small ${filter === "all" ? "bg-gold text-gold-foreground" : "btn-secondary"}`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter("pending")}
                        className={`btn-small ${filter === "pending" ? "bg-gold text-gold-foreground" : "btn-secondary"}`}
                      >
                        Pending
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter("approved")}
                        className={`btn-small ${filter === "approved" ? "bg-gold text-gold-foreground" : "btn-secondary"}`}
                      >
                        Approved
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter("rejected")}
                        className={`btn-small ${filter === "rejected" ? "bg-gold text-gold-foreground" : "btn-secondary"}`}
                      >
                        Rejected
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ["Total Users", summary.totalUsers],
                      ["Total Orders", summary.totalOrders],
                      ["Total Sales", `$${Number(summary.totalSales || 0).toFixed(2)}`],
                      ["Pending Orders", summary.pendingOrders],
                      ["Approved Orders", summary.approvedOrders],
                      ["Rejected Orders", summary.rejectedOrders],
                      ["Active Funded Accounts", summary.activeFundedAccounts],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="metric-card rounded-2xl border border-border bg-background/40"
                      >
                        <p>{label}</p>
                        <b>{String(value)}</b>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "orders" && (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="eyebrow">Orders</p>
                      <h2 className="mt-2 text-3xl font-semibold text-foreground">Order queue</h2>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFilter("all")}
                        className={`btn-small ${filter === "all" ? "bg-gold text-gold-foreground" : "btn-secondary"}`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter("pending")}
                        className={`btn-small ${filter === "pending" ? "bg-gold text-gold-foreground" : "btn-secondary"}`}
                      >
                        Pending
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter("approved")}
                        className={`btn-small ${filter === "approved" ? "bg-gold text-gold-foreground" : "btn-secondary"}`}
                      >
                        Approved
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter("rejected")}
                        className={`btn-small ${filter === "rejected" ? "bg-gold text-gold-foreground" : "btn-secondary"}`}
                      >
                        Rejected
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by order ID, customer name, or email"
                      className="field w-full max-w-md"
                    />
                    <span className="text-sm text-muted-foreground">
                      {filteredOrders.length} results
                    </span>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-background/50">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-surface/80">
                          <tr>
                            <th className="px-4 py-3 font-medium text-muted-foreground">
                              Order ID
                            </th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">
                              Customer
                            </th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Plan</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Broker</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Amount</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-4 py-10 text-center text-muted-foreground"
                              >
                                No orders match your current filters.
                              </td>
                            </tr>
                          ) : (
                            filteredOrders.map((order) => {
                              const owner = userById.get(order.userId);
                              const isActionableOrder =
                                order.orderStatus === "pending_verification" ||
                                order.orderStatus === "payment_rejected";
                              return (
                                <tr key={order.id} className="border-t border-border align-top">
                                  <td className="px-4 py-3 font-mono text-xs">#{order.id}</td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-foreground">
                                      {owner?.name || "Unknown customer"}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {owner?.email || order.userId}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">{order.planName}</td>
                                  <td className="px-4 py-3">{order.broker}</td>
                                  <td className="px-4 py-3">
                                    ${Number(order.amount || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-xs ${order.orderStatus === "pending_verification" ? "bg-amber-500/10 text-amber-300" : order.orderStatus === "approved" || order.orderStatus === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}
                                    >
                                      {statusLabel(order.orderStatus)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className="btn-small btn-secondary"
                                        onClick={() => setSelectedOrder(order)}
                                      >
                                        View
                                      </button>
                                      {isActionableOrder ? (
                                        <>
                                          <button
                                            type="button"
                                            className="btn-small bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                                            onClick={() => handleQuickApprove(order)}
                                          >
                                            Approve
                                          </button>
                                          <button
                                            type="button"
                                            className="btn-small bg-red-500/15 text-red-200 hover:bg-red-500/25"
                                            onClick={() => void handleQuickReject(order)}
                                          >
                                            Reject
                                          </button>
                                        </>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">
                                          Closed
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "plans" && (
                <>
                  <div className="mb-6">
                    <p className="eyebrow">Plans</p>
                    <h2 className="mt-2 text-3xl font-semibold text-foreground">
                      Manage trading plans
                    </h2>
                  </div>
                  <div className="grid gap-4 rounded-2xl border border-border bg-background/50 p-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Type
                      <select
                        value={newPlan.type}
                        onChange={(event) => {
                          const type = event.target.value;
                          setNewPlan((current) => ({
                            ...current,
                            type,
                            ...(type === "Instant" ? instantPlanFields(current.price) : {}),
                          }));
                        }}
                        className="field"
                      >
                        <option>Instant</option>
                        <option>Challenge</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Plan ID
                      <input
                        value={newPlan.id}
                        onChange={(event) =>
                          setNewPlan((current) => ({ ...current, id: event.target.value }))
                        }
                        className="field"
                        placeholder="instant-25000"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Size
                      <input
                        value={newPlan.size}
                        readOnly={newPlan.type === "Instant"}
                        onChange={(event) =>
                          setNewPlan((current) => ({ ...current, size: event.target.value }))
                        }
                        className="field"
                        placeholder="$25,000"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Price
                      <input
                        type="number"
                        value={newPlan.price}
                        onChange={(event) => {
                          const price = event.target.value;
                          setNewPlan((current) => ({
                            ...current,
                            price,
                            ...(current.type === "Instant" ? instantPlanFields(price) : {}),
                          }));
                        }}
                        className="field"
                        placeholder="250"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Daily loss
                      <input
                        value={newPlan.dailyLoss}
                        readOnly={newPlan.type === "Instant"}
                        onChange={(event) =>
                          setNewPlan((current) => ({ ...current, dailyLoss: event.target.value }))
                        }
                        className="field"
                        placeholder="$1,250"
                      />
                    </label>
                    {newPlan.type === "Challenge" && (
                      <>
                        <label className="grid gap-2 text-sm text-muted-foreground">
                          Target
                          <input
                            value={newPlan.target}
                            onChange={(event) =>
                              setNewPlan((current) => ({ ...current, target: event.target.value }))
                            }
                            className="field"
                            placeholder="$2,500"
                          />
                        </label>
                        <label className="grid gap-2 text-sm text-muted-foreground">
                          Drawdown
                          <input
                            value={newPlan.drawdown}
                            onChange={(event) =>
                              setNewPlan((current) => ({
                                ...current,
                                drawdown: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder="$2,500"
                          />
                        </label>
                        <label className="grid gap-2 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                          Description
                          <textarea
                            value={newPlan.description}
                            onChange={(event) =>
                              setNewPlan((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            className="field min-h-24"
                            placeholder="Plan description"
                          />
                        </label>
                      </>
                    )}
                    <label className="grid gap-2 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                      Features (comma separated)
                      <input
                        value={newPlan.features}
                        onChange={(event) =>
                          setNewPlan((current) => ({ ...current, features: event.target.value }))
                        }
                        className="field"
                        placeholder="Fast onboarding, strong support"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={newPlan.active}
                        onChange={(event) =>
                          setNewPlan((current) => ({ ...current, active: event.target.checked }))
                        }
                      />{" "}
                      Active
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={newPlan.popular}
                        onChange={(event) =>
                          setNewPlan((current) => ({ ...current, popular: event.target.checked }))
                        }
                      />{" "}
                      Popular
                    </label>
                    <div className="md:col-span-2 xl:col-span-3">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleCreatePlan()}
                        className="btn-gold disabled:opacity-60"
                      >
                        Add plan
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className="rounded-2xl border border-border bg-background/50 p-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Type
                            <select
                              value={plan.type}
                              onChange={(event) => {
                                const type = event.target.value as PlanRecord["type"];
                                setPlans((current) =>
                                  current.map((entry) =>
                                    entry.id === plan.id
                                      ? {
                                          ...entry,
                                          type,
                                          ...(type === "Instant"
                                            ? instantPlanFields(entry.price)
                                            : {}),
                                        }
                                      : entry,
                                  ),
                                );
                              }}
                              className="field"
                            >
                              <option>Instant</option>
                              <option>Challenge</option>
                            </select>
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Size
                            <input
                              value={plan.size}
                              readOnly={plan.type === "Instant"}
                              onChange={(event) =>
                                setPlans((current) =>
                                  current.map((entry) =>
                                    entry.id === plan.id
                                      ? { ...entry, size: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Price
                            <input
                              type="number"
                              value={plan.price}
                              onChange={(event) => {
                                const price = Number(event.target.value);
                                setPlans((current) =>
                                  current.map((entry) =>
                                    entry.id === plan.id
                                      ? {
                                          ...entry,
                                          price,
                                          ...(entry.type === "Instant"
                                            ? instantPlanFields(price)
                                            : {}),
                                        }
                                      : entry,
                                  ),
                                );
                              }}
                              className="field"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Daily loss
                            <input
                              value={plan.dailyLoss}
                              readOnly={plan.type === "Instant"}
                              onChange={(event) =>
                                setPlans((current) =>
                                  current.map((entry) =>
                                    entry.id === plan.id
                                      ? { ...entry, dailyLoss: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Target
                            <input
                              value={plan.target ?? ""}
                              onChange={(event) =>
                                setPlans((current) =>
                                  current.map((entry) =>
                                    entry.id === plan.id
                                      ? { ...entry, target: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Drawdown
                            <input
                              value={plan.drawdown ?? ""}
                              onChange={(event) =>
                                setPlans((current) =>
                                  current.map((entry) =>
                                    entry.id === plan.id
                                      ? { ...entry, drawdown: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                            Description
                            <textarea
                              value={plan.description}
                              onChange={(event) =>
                                setPlans((current) =>
                                  current.map((entry) =>
                                    entry.id === plan.id
                                      ? { ...entry, description: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field min-h-24"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                            Features
                            <input
                              value={plan.features.join(", ")}
                              onChange={(event) =>
                                setPlans((current) =>
                                  current.map((entry) =>
                                    entry.id === plan.id
                                      ? {
                                          ...entry,
                                          features: event.target.value
                                            .split(",")
                                            .map((item) => item.trim())
                                            .filter(Boolean),
                                        }
                                      : entry,
                                  ),
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={plan.active}
                              onChange={(event) =>
                                setPlans((current) =>
                                  current.map((entry) =>
                                    entry.id === plan.id
                                      ? { ...entry, active: event.target.checked }
                                      : entry,
                                  ),
                                )
                              }
                            />{" "}
                            Active
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={plan.popular ?? false}
                              onChange={(event) =>
                                setPlans((current) =>
                                  current.map((entry) =>
                                    entry.id === plan.id
                                      ? { ...entry, popular: event.target.checked }
                                      : entry,
                                  ),
                                )
                              }
                            />{" "}
                            Popular
                          </label>
                          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-3 justify-end">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => void handleDeletePlan(plan.id)}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className="btn-gold"
                              disabled={submitting}
                              onClick={() => void handleUpdatePlan(plan)}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "brokers" && (
                <>
                  <div className="mb-6">
                    <p className="eyebrow">Brokers</p>
                    <h2 className="mt-2 text-3xl font-semibold text-foreground">
                      Manage broker access
                    </h2>
                  </div>
                  <div className="grid gap-4 rounded-2xl border border-border bg-background/50 p-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Broker ID
                      <input
                        value={newBroker.id}
                        onChange={(event) =>
                          setNewBroker((current) => ({ ...current, id: event.target.value }))
                        }
                        className="field"
                        placeholder="tradowix"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Name
                      <input
                        value={newBroker.name}
                        onChange={(event) =>
                          setNewBroker((current) => ({ ...current, name: event.target.value }))
                        }
                        className="field"
                        placeholder="Tradowix"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground md:col-span-2">
                      Image path
                      <input
                        value={newBroker.image}
                        onChange={(event) =>
                          setNewBroker((current) => ({ ...current, image: event.target.value }))
                        }
                        className="field"
                        placeholder="/brokers/tradowix.jpg"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground md:col-span-2">
                      Description
                      <textarea
                        value={newBroker.copy}
                        onChange={(event) =>
                          setNewBroker((current) => ({ ...current, copy: event.target.value }))
                        }
                        className="field min-h-24"
                        placeholder="Broker description"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={newBroker.enabled}
                        onChange={(event) =>
                          setNewBroker((current) => ({ ...current, enabled: event.target.checked }))
                        }
                      />{" "}
                      Enabled
                    </label>
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleCreateBroker()}
                        className="btn-gold disabled:opacity-60"
                      >
                        Add broker
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4">
                    {brokers.map((broker) => (
                      <div
                        key={broker.id}
                        className="rounded-2xl border border-border bg-background/50 p-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Name
                            <input
                              value={broker.name}
                              onChange={(event) =>
                                setBrokers((current) =>
                                  current.map((entry) =>
                                    entry.id === broker.id
                                      ? { ...entry, name: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Image
                            <input
                              value={broker.image}
                              onChange={(event) =>
                                setBrokers((current) =>
                                  current.map((entry) =>
                                    entry.id === broker.id
                                      ? { ...entry, image: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground md:col-span-2">
                            Description
                            <textarea
                              value={broker.copy}
                              onChange={(event) =>
                                setBrokers((current) =>
                                  current.map((entry) =>
                                    entry.id === broker.id
                                      ? { ...entry, copy: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field min-h-24"
                            />
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={broker.enabled}
                              onChange={(event) =>
                                setBrokers((current) =>
                                  current.map((entry) =>
                                    entry.id === broker.id
                                      ? { ...entry, enabled: event.target.checked }
                                      : entry,
                                  ),
                                )
                              }
                            />{" "}
                            Enabled
                          </label>
                          <div className="flex items-end justify-end gap-2">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => void handleDeleteBroker(broker.id)}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className="btn-gold"
                              disabled={submitting}
                              onClick={() => void handleUpdateBroker(broker)}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "payment-methods" && (
                <>
                  <div className="mb-6">
                    <p className="eyebrow">Payment methods</p>
                    <h2 className="mt-2 text-3xl font-semibold text-foreground">
                      Configure deposit methods
                    </h2>
                  </div>
                  <div className="grid gap-4 rounded-2xl border border-border bg-background/50 p-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Method ID
                      <input
                        value={newMethod.id}
                        onChange={(event) =>
                          setNewMethod((current) => ({ ...current, id: event.target.value }))
                        }
                        className="field"
                        placeholder="usdt-erc20"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Name
                      <input
                        value={newMethod.name}
                        onChange={(event) =>
                          setNewMethod((current) => ({ ...current, name: event.target.value }))
                        }
                        className="field"
                        placeholder="USDT ERC20"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Network
                      <input
                        value={newMethod.network}
                        onChange={(event) =>
                          setNewMethod((current) => ({ ...current, network: event.target.value }))
                        }
                        className="field"
                        placeholder="Ethereum (ERC-20)"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Deposit address
                      <input
                        value={newMethod.depositAddress}
                        onChange={(event) =>
                          setNewMethod((current) => ({
                            ...current,
                            depositAddress: event.target.value,
                          }))
                        }
                        className="field"
                        placeholder="0x..."
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground md:col-span-2">
                      Instructions
                      <textarea
                        value={newMethod.instructions}
                        onChange={(event) =>
                          setNewMethod((current) => ({
                            ...current,
                            instructions: event.target.value,
                          }))
                        }
                        className="field min-h-24"
                        placeholder="Send exact amount and wait for verification."
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Min amount
                      <input
                        type="number"
                        value={newMethod.minimumAmount}
                        onChange={(event) =>
                          setNewMethod((current) => ({
                            ...current,
                            minimumAmount: event.target.value,
                          }))
                        }
                        className="field"
                        placeholder="50"
                      />
                    </label>
                    <label className="grid gap-2 text-sm text-muted-foreground">
                      Max amount
                      <input
                        type="number"
                        value={newMethod.maximumAmount}
                        onChange={(event) =>
                          setNewMethod((current) => ({
                            ...current,
                            maximumAmount: event.target.value,
                          }))
                        }
                        className="field"
                        placeholder="10000"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={newMethod.enabled}
                        onChange={(event) =>
                          setNewMethod((current) => ({ ...current, enabled: event.target.checked }))
                        }
                      />{" "}
                      Enabled
                    </label>
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleCreateMethod()}
                        className="btn-gold disabled:opacity-60"
                      >
                        Add method
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className="rounded-2xl border border-border bg-background/50 p-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Name
                            <input
                              value={method.name}
                              onChange={(event) =>
                                setPaymentMethods((current) =>
                                  current.map((entry) =>
                                    entry.id === method.id
                                      ? { ...entry, name: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Network
                            <input
                              value={method.network}
                              onChange={(event) =>
                                setPaymentMethods((current) =>
                                  current.map((entry) =>
                                    entry.id === method.id
                                      ? { ...entry, network: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground">
                            Address
                            <input
                              value={method.depositAddress}
                              onChange={(event) =>
                                setPaymentMethods((current) =>
                                  current.map((entry) =>
                                    entry.id === method.id
                                      ? { ...entry, depositAddress: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                            Instructions
                            <textarea
                              value={method.instructions}
                              onChange={(event) =>
                                setPaymentMethods((current) =>
                                  current.map((entry) =>
                                    entry.id === method.id
                                      ? { ...entry, instructions: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="field min-h-24"
                            />
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={method.enabled}
                              onChange={(event) =>
                                setPaymentMethods((current) =>
                                  current.map((entry) =>
                                    entry.id === method.id
                                      ? { ...entry, enabled: event.target.checked }
                                      : entry,
                                  ),
                                )
                              }
                            />{" "}
                            Enabled
                          </label>
                          <div className="flex items-end justify-end gap-2 md:col-span-2 xl:col-span-3">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => void handleDeleteMethod(method.id)}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className="btn-gold"
                              disabled={submitting}
                              onClick={() => void updatePaymentMethod(method)}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "users" && (
                <>
                  <div className="mb-6">
                    <p className="eyebrow">Users</p>
                    <h2 className="mt-2 text-3xl font-semibold text-foreground">
                      Customer accounts
                    </h2>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border bg-background/50">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-surface/80">
                          <tr>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                            <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((entry) => (
                            <tr key={entry.id} className="border-t border-border">
                              <td className="px-4 py-3">{entry.name}</td>
                              <td className="px-4 py-3">{entry.email}</td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">
                                  {entry.account_status || entry.accountStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3">{entry.admin ? "Admin" : "Customer"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </main>
          </div>
        </div>

        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-surface-elevated p-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Order review</p>
                  <h3 className="mt-2 text-2xl font-semibold">#{selectedOrder.id}</h3>
                </div>
                <button
                  type="button"
                  className="btn-small btn-secondary"
                  onClick={() => setSelectedOrder(null)}
                >
                  Close
                </button>
              </div>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <h4 className="text-lg font-semibold">Customer</h4>
                  <p className="mt-3">
                    {userById.get(selectedOrder.userId)?.name || "Unknown customer"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {userById.get(selectedOrder.userId)?.email || selectedOrder.userId}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <h4 className="text-lg font-semibold">Purchase</h4>
                  <p className="mt-3">{selectedOrder.planName}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.broker} · {selectedOrder.paymentMethodName}
                  </p>
                  <p className="mt-2 font-medium">
                    ${Number(selectedOrder.amount || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-background p-4">
                <h4 className="text-lg font-semibold">Payment</h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Method:</span>{" "}
                    {selectedOrder.paymentMethodName}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Network:</span> {selectedOrder.network}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Amount:</span> $
                    {Number(selectedOrder.amount || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">TXID:</span>{" "}
                    {selectedOrder.transactionHash || "Not provided"}
                  </p>
                </div>
                {selectedOrder.paymentProof ? (
                  <div className="mt-4 space-y-3">
                    <a
                      href={`${apiOrigin}${selectedOrder.paymentProof}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-link"
                    >
                      Open payment proof
                    </a>
                    <img
                      src={`${apiOrigin}${selectedOrder.paymentProof}`}
                      alt={selectedOrder.paymentProofName || "Payment proof"}
                      className="max-h-72 w-full rounded-xl border border-border bg-background object-contain"
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No payment proof has been uploaded for this order yet.
                  </p>
                )}
              </div>
              {message ? (
                <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {message}
                </div>
              ) : null}
              <div className="mt-6 rounded-2xl border border-border bg-background p-4">
                <h4 className="text-lg font-semibold">Reject order</h4>
                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  className="field mt-3 min-h-24"
                  placeholder="Optional rejection reason"
                />
                <button
                  type="button"
                  disabled={submitting}
                  className="btn-secondary mt-3"
                  onClick={() => void handleReject()}
                >
                  Reject Order
                </button>
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-background p-4">
                <h4 className="text-lg font-semibold">Approve & deliver account</h4>
                <div className="mt-4 grid gap-4">
                  <label>
                    Account Email
                    <input
                      type="email"
                      value={approvalForm.accountEmail}
                      onChange={(event) =>
                        setApprovalForm((current) => ({
                          ...current,
                          accountEmail: event.target.value,
                        }))
                      }
                      className="field mt-2"
                      placeholder="customer-account@example.com"
                    />
                  </label>
                  <label>
                    Account Password
                    <input
                      type="password"
                      value={approvalForm.accountPassword}
                      onChange={(event) =>
                        setApprovalForm((current) => ({
                          ...current,
                          accountPassword: event.target.value,
                        }))
                      }
                      className="field mt-2"
                      placeholder="Enter broker account password"
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedOrder(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      submitting || !approvalForm.accountEmail || !approvalForm.accountPassword
                    }
                    className="btn-gold disabled:opacity-50"
                    onClick={() => void handleApproval()}
                  >
                    Approve & Deliver Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminOnlyLayout>
  );
}
