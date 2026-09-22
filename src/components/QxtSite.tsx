import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  Headphones,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  brokers,
  challengePlans,
  customDirectPlanId,
  faqs,
  getCustomDirectPlan,
  instantPlans,
  reviews,
  type Plan,
} from "@/lib/qxt-data";
import { useAuth } from "@/lib/auth";
import {
  getActiveBrokersWithCache,
  getCachedBrokers,
  getCachedPlans,
  getPlansWithCache,
  createPasswordReset,
  getActivePaymentMethods,
  loginUser,
  logoutUser,
  registerUser,
  submitPasswordResetProof,
  updateAccountSettings,
  ApiError,
  type AccountStatus,
  type BrokerRecord,
  type PlanRecord,
  type PaymentMethod,
  type PasswordResetRequest,
} from "@/lib/backend";
import type { LegalDocument } from "@/lib/qxt-legal-data";

const nav = [
  ["Accounts", "/accounts"],
  ["Brokers", "/brokers"],
  ["How It Works", "/how-it-works"],
  ["FAQ", "/faq"],
  ["Reviews", "/reviews"],
  ["Support", "/support"],
] as const;

function getUserInitials(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.[0]?.toUpperCase() || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0]?.toUpperCase() || "" : first;
  return `${first}${last}`.slice(0, 2);
}

const fallbackPlans: Plan[] = [...instantPlans, ...challengePlans];
const fallbackBrokers: BrokerRecord[] = brokers.map((broker) => ({
  id: broker.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name: broker.name,
  enabled: true,
  image: broker.image,
  copy: broker.copy,
}));

function usePublicPlans() {
  const [plans, setPlans] = useState<Plan[]>(() => getCachedPlans()?.data || fallbackPlans);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let active = true;
    const syncPlans = () =>
      getPlansWithCache()
        .then((result) => {
          if (!active) return;
          setPlans(result.data as PlanRecord[]);
          setStale(result.source === "cache");
        })
        .catch(() => {
          if (active) setStale(true);
        });
    void syncPlans();
    const retry = () => void syncPlans();
    window.addEventListener("online", retry);
    const interval = window.setInterval(retry, 15000);
    return () => {
      active = false;
      window.removeEventListener("online", retry);
      window.clearInterval(interval);
    };
  }, []);

  return { plans, stale };
}

function usePublicBrokers() {
  const [brokerList, setBrokerList] = useState<BrokerRecord[]>(
    () => getCachedBrokers()?.data || fallbackBrokers,
  );
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let active = true;
    const syncBrokers = () =>
      getActiveBrokersWithCache()
        .then((result) => {
          if (!active) return;
          setBrokerList(result.data);
          setStale(result.source === "cache");
        })
        .catch(() => {
          if (active) setStale(true);
        });
    void syncBrokers();
    const retry = () => void syncBrokers();
    window.addEventListener("online", retry);
    const interval = window.setInterval(retry, 15000);
    return () => {
      active = false;
      window.removeEventListener("online", retry);
      window.clearInterval(interval);
    };
  }, []);

  return { brokers: brokerList, stale };
}

export function SyncNotice({ kind }: { kind: "plans" | "brokers" | "orders" }) {
  const label = kind === "orders" ? "orders" : kind;
  return (
    <p className="mt-4 text-xs text-amber-300">
      Showing saved {label}. Refresh to sync when the backend reconnects.
    </p>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold text-foreground">
      <span className="grid size-8 place-items-center rounded-md border border-gold/30 bg-gold/10 text-gold">
        <TrendingUp size={17} />
      </span>
      <span>
        <b className="text-gold">QXT</b> Funded
      </span>
    </Link>
  );
}

export function Header() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, initializing, signOut } = useAuth();

  useEffect(() => {
    if (!profileOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const wrapper = document.getElementById("profile-menu-wrapper");
      if (wrapper && !wrapper.contains(target)) setProfileOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [profileOpen]);

  const initials = getUserInitials(user?.name);

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      setProfileOpen(false);
      navigate({ to: "/login" });
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-x grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center lg:grid-cols-[auto_1fr_auto]">
        <Logo />
        <nav className="hidden items-center justify-center gap-8 lg:flex">
          {nav.map(([label, to]) => (
            <Link
              key={to}
              to={to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-gold" }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          {initializing ? (
            <div
              className="h-8 w-24 animate-pulse rounded-md bg-muted"
              aria-label="Loading account"
            />
          ) : user ? (
            <div id="profile-menu-wrapper" className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((value) => !value)}
                className="flex items-center gap-3 rounded-full border border-border bg-surface px-2 py-1.5 text-sm text-foreground hover:border-gold/40"
              >
                <span className="grid size-8 place-items-center rounded-full bg-gold/10 text-[10px] font-bold text-gold">
                  {initials}
                </span>
                <span>{user.name}</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-2xl">
                  <Link
                    to="/account-settings"
                    onClick={() => setProfileOpen(false)}
                    className="block px-4 py-3 text-sm text-foreground hover:bg-muted"
                  >
                    Account settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full border-t border-border px-4 py-3 text-left text-sm text-foreground hover:bg-muted"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign In
            </Link>
          )}
          {user ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-gold"
              activeProps={{ className: "inline-flex items-center gap-2 text-sm text-gold" }}
            >
              <ClipboardList size={15} />
              View Orders
            </Link>
          ) : null}
          <GoldLink to="/accounts">Get Funded</GoldLink>
        </div>
        <button
          aria-label="Open menu"
          className="grid size-10 place-items-center text-foreground lg:hidden"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-5 py-5 lg:hidden">
          <nav className="flex flex-col gap-1">
            {nav.map(([label, to]) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {label}
              </Link>
            ))}
            <div className="mt-3 grid gap-3">
              {initializing ? null : user ? (
                <div className="grid gap-2">
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-md border border-gold/30 bg-gold/10 px-3 py-3 text-sm text-gold"
                  >
                    <ClipboardList size={16} />
                    <span>View Orders</span>
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-3 text-sm text-foreground"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-gold/10 text-[10px] font-bold text-gold">
                      {initials}
                    </span>
                    <span>{user.name}</span>
                  </Link>
                  <Link
                    to="/account-settings"
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-border bg-surface px-3 py-3 text-sm text-foreground"
                  >
                    Account settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void handleLogout();
                    }}
                    className="rounded-md border border-border bg-surface px-3 py-3 text-left text-sm text-foreground"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary">
                  Sign In
                </Link>
              )}
              <Link to="/accounts" onClick={() => setOpen(false)} className="btn-gold">
                Get Funded
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

type SitePath =
  | "/"
  | "/accounts"
  | "/brokers"
  | "/how-it-works"
  | "/faq"
  | "/reviews"
  | "/support"
  | "/contact"
  | "/login"
  | "/checkout"
  | "/dashboard"
  | "/account-settings"
  | "/legal/terms"
  | "/legal/privacy"
  | "/legal/refund"
  | "/legal/risk"
  | "/legal/cookies";
export function GoldLink({
  to,
  children,
  search,
}: {
  to: SitePath;
  children: ReactNode;
  search?: { plan: string };
}) {
  if (to === "/checkout" && search)
    return (
      <Link to="/checkout" search={search} className="btn-gold">
        {children}
        <ArrowRight size={15} />
      </Link>
    );
  return (
    <Link to={to} className="btn-gold">
      {children}
      <ArrowRight size={15} />
    </Link>
  );
}

export function Layout({ children, minimal = false }: { children: ReactNode; minimal?: boolean }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {!minimal && <Header />}
      <div className={minimal ? "" : "pt-16"}>
        <main>{children}</main>
        {!minimal && <Footer />}
        {!minimal && <CookieBanner />}
        {!minimal && <ChatWidget />}
      </div>
    </div>
  );
}

export function AccountStatusScreen({ status }: { status: AccountStatus }) {
  const copy =
    status === "pending"
      ? [
          "Account Pending",
          "Your account is currently pending. Please wait until your account is activated.",
        ]
      : status === "suspended"
        ? [
            "Account Suspended",
            "Your account has been suspended. Please contact support for assistance.",
          ]
        : [
            "Account Locked",
            "Your account has been locked. Please contact support for assistance.",
          ];
  return (
    <Layout minimal>
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl rounded-md border border-border bg-surface p-8 text-center shadow-sm sm:p-10">
          <p className="eyebrow">Account access</p>
          <h1 className="mt-4 text-3xl font-semibold">{copy[0]}</h1>
          <p className="mt-4 leading-7 text-muted-foreground">{copy[1]}</p>
          <Link to="/contact" className="btn-secondary mt-7">
            Contact support
          </Link>
        </div>
      </main>
    </Layout>
  );
}

export function Footer() {
  const legal = [
    ["Terms", "/legal/terms"],
    ["Privacy", "/legal/privacy"],
    ["Refunds", "/legal/refund"],
    ["Risk Disclosure", "/legal/risk"],
    ["Cookies", "/legal/cookies"],
  ] as const;
  return (
    <footer className="border-t border-border bg-surface py-14">
      <div className="container-x grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            Built for disciplined traders. Clear rules, trusted platforms, and up to 92% of the
            profits you generate.
          </p>
        </div>
        <div>
          <p className="eyebrow">Explore</p>
          <div className="mt-4 grid gap-3 text-sm">
            {nav.slice(0, 4).map(([l, t]) => (
              <Link key={t} to={t} className="text-muted-foreground hover:text-gold">
                {l}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow">Support</p>
          <div className="mt-4 grid gap-3 text-sm">
            <Link to="/support" className="text-muted-foreground hover:text-gold">
              Support Center
            </Link>
            <Link to="/contact" className="text-muted-foreground hover:text-gold">
              Contact Us
            </Link>
            <a
              href="mailto:support@qxtfunded.org"
              className="text-muted-foreground hover:text-gold"
            >
              support@qxtfunded.org
            </a>
            <p className="text-muted-foreground">Available 24/7</p>
          </div>
        </div>
        <div>
          <p className="eyebrow">Legal</p>
          <div className="mt-4 grid gap-3 text-sm">
            {legal.map(([l, t]) => (
              <Link key={t} to={t} className="text-muted-foreground hover:text-gold">
                {l}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="container-x mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <span>© 2026 QXT Funded. All rights reserved.</span>
        <span>Trading involves risk. Simulated environments only.</span>
      </div>
    </footer>
  );
}

function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(localStorage.getItem("qxt-cookie") === null);
  }, []);
  if (!show) return null;
  const close = (v: string) => {
    localStorage.setItem("qxt-cookie", v);
    setShow(false);
  };
  return (
    <div className="cookie-banner fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-lg border border-border bg-surface-elevated p-4 shadow-2xl">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <span className="grid size-9 place-items-center rounded-md border border-gold/30 bg-gold/10 text-gold">
          <CookieIcon />
        </span>
        <p className="text-xs leading-5 text-muted-foreground">
          We use functional cookies to safeguard your trader dashboard, maintain active evaluation
          sessions, and secure payments.{" "}
          <Link to="/legal/cookies" className="text-gold">
            Learn more in our Cookies Policy.
          </Link>
        </p>
        <div className="flex gap-2">
          <button className="btn-small-secondary" onClick={() => close("essential")}>
            Essential Only
          </button>
          <button className="btn-small-gold" onClick={() => close("all")}>
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
function CookieIcon() {
  return <span className="text-base">◔</span>;
}

const supportQuestions = [
  {
    question: "What is QX Funded?",
    answer:
      "QXT Funded gives skilled traders access to Instant or Challenge accounts in simulated trading environments, with funding available after the applicable evaluation path.",
  },
  {
    question: "How can I purchase a challenge?",
    answer:
      "Open Accounts, choose Challenge Accounts, select a plan, and follow the checkout steps to choose a broker, payment method, and submit payment proof.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "The available payment methods are shown during checkout after you select a broker. Choose from the options displayed there to continue.",
  },
  {
    question: "How do I submit my payment proof?",
    answer:
      "After sending the exact payment amount, select I Have Paid in checkout. The next step lets you upload your payment proof and submit it with the order.",
  },
  {
    question: "How long does order verification take?",
    answer:
      "The How It Works page says most verifications complete within one business day. You can follow the current order status from your dashboard.",
  },
  {
    question: "Where can I see my order status?",
    answer:
      "Sign in and open your Trader Dashboard at /dashboard. Your orders and their current statuses are listed there.",
  },
  {
    question: "How do I access my funded account?",
    answer:
      "After an order is approved, open that order in your dashboard. Approved orders provide access to the funded account credentials when they are available.",
  },
  {
    question: "Where can I find my funded account credentials?",
    answer:
      "Open the approved order in your dashboard and use its account section to reveal the available email and password credentials.",
  },
  {
    question: "What happens after my payment is approved?",
    answer:
      "The order moves to an approved status, and the account credentials become available from the approved order in your dashboard.",
  },
  {
    question: "Can I have multiple accounts?",
    answer:
      "You can purchase another account by returning to Accounts and selecting an additional plan. Each purchase is tracked as its own order in your dashboard.",
  },
  {
    question: "How can I contact support?",
    answer:
      "Open the Support or Contact page, or email support@qxtfunded.org. The website also provides a support ticket option for account, billing, and technical issues.",
  },
  {
    question: "How do I update my account information?",
    answer: "Sign in and open Account Settings to update your profile information.",
  },
] as const;

type ChatMessage = { sender: "support" | "customer"; text: string };

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const askQuestion = (question: (typeof supportQuestions)[number]) => {
    setMessages((current) => [
      ...current,
      { sender: "customer", text: question.question },
      { sender: "support", text: question.answer },
    ]);
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="chat-toggle fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-gold/40 bg-surface-elevated px-4 py-3 text-xs font-semibold shadow-xl"
      >
        <MessageCircle size={16} className="text-gold" />
        <span>24/7 Live Chat</span>
      </button>
      {open && (
        <div className="chat-panel fixed bottom-20 right-5 z-40 w-[calc(100%-2.5rem)] max-w-sm rounded-lg border border-border bg-surface-elevated p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <b>QXT Support</b>
            <button aria-label="Close chat" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="my-5 max-h-80 space-y-3 overflow-y-auto pr-1">
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Hi! How can we help you today?
            </div>
            {messages.map((message, index) => (
              <div
                key={`${message.sender}-${index}`}
                className={`rounded-md p-3 text-sm ${
                  message.sender === "customer"
                    ? "ml-5 bg-gold/10 text-foreground"
                    : "mr-5 bg-muted text-muted-foreground"
                }`}
              >
                {message.text}
              </div>
            ))}
            <div className="space-y-2">
              {supportQuestions.map((question) => (
                <button
                  key={question.question}
                  type="button"
                  className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-gold hover:text-foreground"
                  onClick={() => askQuestion(question)}
                >
                  {question.question}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input className="field" placeholder="Type a message…" />
            <button className="icon-gold" aria-label="Send message">
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function SectionHead({
  eyebrow,
  title,
  copy,
  center = false,
  level = "h2",
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  center?: boolean;
  level?: "h1" | "h2";
}) {
  const Heading = level;
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <Heading className="section-title">{title}</Heading>
      {copy && <p className="section-copy">{copy}</p>}
    </div>
  );
}

export function HomePage() {
  const { plans, stale: plansStale } = usePublicPlans();
  const { brokers: brokerList, stale: brokersStale } = usePublicBrokers();
  return (
    <Layout>
      <section className="hero-grid relative overflow-hidden">
        <div className="hero-line" />
        <div className="container-x relative flex min-h-[650px] items-center py-20">
          <div className="max-w-2xl">
            <div className="status-pill">
              <span />
              Live evaluations open · 5 broker environments
            </div>
            <h1 className="hero-title">
              Prove your edge.
              <br />
              <em>Get funded.</em>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              QXT Funded gives skilled traders access to capital up to $50,000. Start with an
              Instant account or prove yourself through a simulated evaluation — then keep up to 92%
              of the profits you generate.
            </p>
            <div className="mt-7 flex flex-wrap gap-4">
              <GoldLink to="/accounts">Start Trading</GoldLink>
              <Link to="/how-it-works" className="btn-ghost">
                How It Works <ArrowRight size={15} />
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-6 border-t border-border pt-7 sm:grid-cols-4">
              {[
                ["$50K", "Max Funding"],
                ["92%", "Profit Split"],
                ["5", "Broker Options"],
                ["24/7", "Support"],
              ].map(([v, l]) => (
                <div key={l}>
                  <b className="font-mono text-2xl text-gold">{v}</b>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {l}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Benefits />
      <section className="section">
        <div className="container-x">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <SectionHead
              eyebrow="Account Types"
              title="Choose your trading account"
              copy="Instant accounts for direct trading, or Challenge accounts with a lower entry cost."
            />
            <Link to="/accounts" className="text-link">
              View all accounts <ArrowRight size={15} />
            </Link>
          </div>
          <PlanGrid plans={plans.filter((plan) => plan.type === "Instant").slice(0, 4)} />
          {plansStale && <SyncNotice kind="plans" />}
        </div>
      </section>
      <BrokersStrip brokers={brokerList} stale={brokersStale} />
      <ReviewsSection />
      <FaqSection limit={4} />
      <Cta />
    </Layout>
  );
}

function Benefits() {
  const items = [
    [
      TrendingUp,
      "Up to 92% split",
      "Among the highest profit splits in the industry, paid on a recurring cycle.",
    ],
    [
      Clock3,
      "Instant or evaluation",
      "Skip the wait with an Instant account, or take the lower-cost Challenge path.",
    ],
    [
      ShieldCheck,
      "Transparent rules",
      "Every limit — daily loss, drawdown, profit target — is stated upfront.",
    ],
    [
      Headphones,
      "24/7 support",
      "A support team and ticketing system that responds, day or night.",
    ],
  ] as const;
  return (
    <section className="section border-y border-border bg-surface">
      <div className="container-x">
        <SectionHead
          eyebrow="Why traders choose us"
          title="Built for traders who take this seriously"
        />
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {items.map(([I, t, c]) => (
            <article key={t} className="bg-surface p-7">
              <I className="text-gold" />
              <h3 className="mt-7 text-lg font-semibold">{t}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{c}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PlanGrid({ plans, before }: { plans: Plan[]; before?: ReactNode }) {
  return (
    <div className="mt-10 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
      {before}
      {plans.map((p) => (
        <article key={p.id} className={`plan-card ${p.popular ? "popular" : ""}`}>
          {p.popular && <span className="popular-tag">Popular</span>}
          <p className="eyebrow">{p.type === "Instant" ? "Direct Funding" : "Evaluation"}</p>
          <h3 className="mt-4 font-mono text-4xl font-bold">{p.size}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Account size · <b className="text-foreground">${p.price}</b> one-time
          </p>
          <dl className="my-7 grid gap-3 border-y border-border py-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Daily Loss Limit</dt>
              <dd>{p.dailyLoss}</dd>
            </div>
            {p.target && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Profit Target</dt>
                <dd>{p.target}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Profit Split</dt>
              <dd className="text-gold">92%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Funding Type</dt>
              <dd>{p.type}</dd>
            </div>
          </dl>
          <GoldLink to="/checkout" search={{ plan: p.id }}>
            Get Funded
          </GoldLink>
        </article>
      ))}
    </div>
  );
}

function BrokersStrip({ brokers: brokerList, stale }: { brokers: BrokerRecord[]; stale: boolean }) {
  return (
    <section className="section bg-surface">
      <div className="container-x">
        <SectionHead eyebrow="Trading Environments" title="Trade on platforms you already know" />
        <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-5">
          {brokerList.map((b) => (
            <div className="broker-tile" key={b.name}>
              <img src={b.image} alt="" />
              <b>{b.name}</b>
              <span>
                <i />
                Active
              </span>
            </div>
          ))}
        </div>
        {stale && <SyncNotice kind="brokers" />}
      </div>
    </section>
  );
}
function ReviewsSection() {
  return (
    <section className="section">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
          <div>
            <p className="eyebrow">Trustpilot</p>
            <h2 className="section-title">What our traders say</h2>
            <div className="mt-6 flex items-end gap-3">
              <b className="text-5xl">4.8</b>
              <span className="pb-1 text-sm text-muted-foreground">from 2,400+ reviews</span>
            </div>
            <div className="mt-3 text-xl text-gold">★★★★★</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <ReviewCard key={r.name} {...r} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
function ReviewCard({
  quote,
  initials,
  name,
  country,
}: {
  quote: string;
  initials: string;
  name: string;
  country: string;
}) {
  return (
    <article className="review-card">
      <div className="text-gold">★★★★★</div>
      <p className="mt-5 leading-7">“{quote}”</p>
      <div className="mt-7 flex items-center gap-3">
        <span className="avatar">{initials}</span>
        <div>
          <b className="text-sm">{name}</b>
          <p className="text-xs text-muted-foreground">{country}</p>
        </div>
      </div>
    </article>
  );
}

export function FaqSection({ limit }: { limit?: number }) {
  const list = limit ? faqs.slice(0, limit) : faqs;
  return (
    <section className="section bg-surface">
      <div className="container-x">
        <SectionHead eyebrow="Questions" title="Frequently asked questions" />
        <div className="mt-9 max-w-4xl divide-y divide-border border-y border-border">
          {list.map((f, i) => (
            <FaqRow key={f.q} {...f} start={i === 0} />
          ))}
        </div>
        {limit && (
          <Link to="/faq" className="text-link mt-7">
            View all FAQs <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </section>
  );
}
function FaqRow({ q, a, start = false }: { q: string; a: string; start?: boolean }) {
  const [open, setOpen] = useState(start);
  return (
    <div>
      <button
        className="grid w-full grid-cols-[1fr_auto] items-center gap-5 py-6 text-left font-medium"
        onClick={() => setOpen(!open)}
      >
        <span>{q}</span>
        <ChevronDown
          size={18}
          className={`text-gold transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <p className="max-w-3xl pb-6 text-sm leading-7 text-muted-foreground">{a}</p>}
    </div>
  );
}
function Cta() {
  return (
    <section className="section gold-grid">
      <div className="container-x text-center">
        <h2 className="section-title mx-auto max-w-2xl">Ready to trade with real backing?</h2>
        <p className="section-copy mx-auto max-w-xl">
          Choose your account size and get started in minutes. Your dashboard, orders, and payouts
          are all in one place.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <GoldLink to="/accounts">Get Funded</GoldLink>
          <Link to="/faq" className="btn-secondary">
            Read the FAQ
          </Link>
        </div>
      </div>
    </section>
  );
}

export function StandardHero({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <section className="page-hero hero-grid">
      <div className="container-x">
        <SectionHead eyebrow={eyebrow} title={title} copy={copy} level="h1" />
      </div>
    </section>
  );
}

function CustomPlanCard({
  customAmount,
  customPlan,
  customValidation,
  onAmountChange,
  selectCustomPlan,
}: {
  customAmount: string;
  customPlan: Plan | null;
  customValidation: string;
  onAmountChange: (value: string) => void;
  selectCustomPlan: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="custom-plan-panel p-5">
      <div>
        <p className="eyebrow">Direct Funding</p>
        <h2 className="mt-2 text-xl font-semibold">Create your own plan</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Enter your payment amount to see your funding details.
        </p>
      </div>
      <form className="mt-5 grid gap-4" onSubmit={selectCustomPlan}>
        <div>
          <label htmlFor="custom-plan-amount">How much would you like to pay?</label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted-foreground">
              $
            </span>
            <input
              id="custom-plan-amount"
              className="field pl-8"
              type="number"
              min="10"
              step="0.01"
              inputMode="decimal"
              value={customAmount}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="70.00"
              aria-describedby="custom-plan-validation"
            />
          </div>
          <p
            id="custom-plan-validation"
            className={`mt-2 text-xs ${customValidation ? "text-amber-300" : "text-muted-foreground"}`}
          >
            {customValidation || "Minimum payment: $10 USD"}
          </p>
        </div>
        <div className="custom-plan-summary">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Your payment</span>
            <strong>{customPlan ? `$${customPlan.price.toFixed(2)}` : "—"}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Funding account</span>
            <strong className="text-gold">{customPlan?.size || "—"}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Daily loss limit</span>
            <strong>{customPlan?.dailyLoss || "—"}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Profit split</span>
            <strong className="text-gold">92%</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Funding type</span>
            <strong>Instant</strong>
          </div>
          <button type="submit" className="btn-gold mt-5 w-full" disabled={!customPlan}>
            Continue with custom plan <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </section>
  );
}

export function AccountsPage() {
  const [tab, setTab] = useState<"instant" | "challenge">("instant");
  const [customAmount, setCustomAmount] = useState("");
  const { plans, stale } = usePublicPlans();
  const navigate = useNavigate();
  const parsedCustomAmount = customAmount.trim() === "" ? Number.NaN : Number(customAmount);
  const customPlan = getCustomDirectPlan(parsedCustomAmount);
  const customValidation =
    customAmount.trim() === ""
      ? "Enter an amount of at least $10."
      : !Number.isFinite(parsedCustomAmount) || parsedCustomAmount < 0
        ? "Enter a valid positive USD amount."
        : parsedCustomAmount < 10
          ? "The minimum payment is $10."
          : !Number.isSafeInteger(Math.round(parsedCustomAmount * 100))
            ? "Enter a valid USD amount."
            : "";

  const selectCustomPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customPlan) return;
    navigate({ to: "/checkout", search: { plan: customDirectPlanId(customPlan.price) } });
  };

  return (
    <Layout>
      <StandardHero
        eyebrow="Account Types"
        title="Choose your trading account"
        copy="Instant accounts for direct trading, or Challenge accounts with a lower entry cost that unlock funding once you clear the evaluation."
      />
      <section className="section pt-0">
        <div className="container-x">
          <div className="segmented">
            <button onClick={() => setTab("instant")} className={tab === "instant" ? "active" : ""}>
              Instant Accounts
            </button>
            <button
              onClick={() => setTab("challenge")}
              className={tab === "challenge" ? "active" : ""}
            >
              Challenge Accounts
            </button>
          </div>
          <PlanGrid
            plans={plans.filter(
              (plan) => plan.type === (tab === "instant" ? "Instant" : "Challenge"),
            )}
            before={
              <CustomPlanCard
                customAmount={customAmount}
                customPlan={customPlan}
                customValidation={customValidation}
                onAmountChange={setCustomAmount}
                selectCustomPlan={selectCustomPlan}
              />
            }
          />
          {stale && <SyncNotice kind="plans" />}
          <p className="mt-8 text-xs leading-6 text-muted-foreground">
            All accounts run on simulated evaluation environments. Profit splits are paid from firm
            capital once an account reaches funded status.
          </p>
        </div>
      </section>
    </Layout>
  );
}
export function BrokersPage() {
  const { brokers: brokerList, stale } = usePublicBrokers();
  return (
    <Layout>
      <StandardHero
        eyebrow="Trading Environments"
        title="Trade on the platforms you know"
        copy="Every account gives you a choice of broker environment. Pick the one that matches how you already trade."
      />
      <section className="section pt-0">
        <div className="container-x grid gap-4 md:grid-cols-2">
          {brokerList.map((b) => (
            <article key={b.name} className="broker-card">
              <div className="flex items-center justify-between">
                <img src={b.image} alt="" />
                <span className="active-badge">
                  <i />
                  Active
                </span>
              </div>
              <h3 className="mt-8 text-2xl font-semibold">{b.name}</h3>
              <p className="mt-2 text-muted-foreground">{b.copy}</p>
              <Link to="/accounts" className="text-link mt-6">
                Choose this platform <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
        {stale && <SyncNotice kind="brokers" />}
      </section>
    </Layout>
  );
}
export function HowPage() {
  const steps = [
    [
      "01",
      "Choose your account",
      "Pick an Instant account to start trading right away, or a Challenge account with a lower entry cost.",
    ],
    [
      "02",
      "Complete the evaluation",
      "Trade within the daily loss and drawdown limits. Hit the profit target and move to the next stage.",
    ],
    [
      "03",
      "Verification",
      "We confirm your trading history against the account rules. Most verifications complete within one business day.",
    ],
    [
      "04",
      "Get funded",
      "Receive your funded account and start earning your profit split — up to 92% — on every payout cycle.",
    ],
  ];
  return (
    <Layout>
      <StandardHero
        eyebrow="The Path to Funding"
        title="From account purchase to funded trader"
        copy="A transparent route from selecting an account to earning on funded capital."
      />
      <section className="section pt-0">
        <div className="container-x max-w-4xl">
          {steps.map(([n, t, c]) => (
            <div className="step-row" key={n}>
              <b>{n}</b>
              <div>
                <h3>{t}</h3>
                <p>{c}</p>
              </div>
            </div>
          ))}
          <div className="mt-10">
            <GoldLink to="/accounts">Start with an account</GoldLink>
          </div>
        </div>
      </section>
    </Layout>
  );
}
export function FaqPage() {
  const [cat, setCat] = useState("All");
  const cats = ["All", "Accounts", "Challenge", "Risk Rules", "Brokers", "Payouts"];
  const filtered = cat === "All" ? faqs : faqs.filter((f) => f.cat === cat);
  return (
    <Layout>
      <StandardHero
        eyebrow="Support"
        title="Frequently asked questions"
        copy="Find immediate answers about accounts, rules, and payouts."
      />
      <section className="section pt-0">
        <div className="container-x">
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`filter-chip ${cat === c ? "active" : ""}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-7 max-w-4xl divide-y divide-border border-y border-border">
            {filtered.map((f) => (
              <FaqRow key={f.q} {...f} />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
export function ReviewsPage() {
  return (
    <Layout>
      <StandardHero
        eyebrow="Trustpilot"
        title="What our traders say"
        copy="Verified experiences from traders using QXT Funded across the world."
      />
      <section className="section pt-0">
        <div className="container-x">
          <div className="mb-9 flex items-center gap-4">
            <b className="text-5xl">4.8</b>
            <div>
              <div className="text-gold">★★★★★</div>
              <p className="text-sm text-muted-foreground">from 2,400+ reviews</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <ReviewCard key={r.name} {...r} />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

export function SupportPage() {
  const [sent, setSent] = useState(false);
  const options: { Icon: LucideIcon; title: string; copy: string }[] = [
    {
      Icon: MessageCircle,
      title: "Live Chat",
      copy: "Connect instantly with our support team in real-time 24/7.",
    },
    {
      Icon: Mail,
      title: "Open a Ticket",
      copy: "Create a support ticket for account, billing, or technical issues.",
    },
    {
      Icon: CircleHelp,
      title: "Browse the FAQ",
      copy: "Most questions about accounts, rules, and payouts are answered.",
    },
  ];
  return (
    <Layout>
      <StandardHero
        eyebrow="We're here to help"
        title="Support Center"
        copy="Search the FAQ, start a live chat session, browse your tickets, or reach out directly — our team responds 24/7."
      />
      <section className="section pt-0">
        <div className="container-x grid gap-4 md:grid-cols-3">
          {options.map(({ Icon, title, copy }) => (
            <article className="support-card" key={title}>
              <Icon className="text-gold" />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-14 max-w-2xl">
          <h2 className="text-2xl font-semibold">Send us a message</h2>
          {sent ? (
            <div className="success-box mt-6">
              <Check />
              Your message has been received. We’ll reply shortly.
            </div>
          ) : (
            <form
              className="mt-6 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  Name
                  <input className="field mt-2" required />
                </label>
                <label>
                  Email
                  <input className="field mt-2" type="email" required />
                </label>
              </div>
              <label>
                Topic
                <select className="field mt-2">
                  <option>Account question</option>
                  <option>Billing</option>
                  <option>Technical issue</option>
                </select>
              </label>
              <label>
                Message
                <textarea className="field mt-2 min-h-32" required />
              </label>
              <button className="btn-gold w-fit" type="submit">
                Send Message <ArrowRight size={15} />
              </button>
            </form>
          )}
        </div>
      </section>
    </Layout>
  );
}

export function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <Layout>
      <StandardHero
        eyebrow="Get in touch"
        title="Contact Us"
        copy="Questions before you sign up? Send us a message and we'll get back to you within a day."
      />
      <section className="section pt-0">
        <div className="container-x grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="contact-panel">
            <h2 className="text-2xl font-semibold">Send a message</h2>
            {sent ? (
              <div className="success-box mt-7">
                <Check />
                Thanks for reaching out. We’ll get back to you within one day.
              </div>
            ) : (
              <form
                className="mt-7 grid gap-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
              >
                <label>
                  Full Name
                  <input className="field mt-2" required autoComplete="name" />
                </label>
                <label>
                  Email
                  <input className="field mt-2" type="email" required autoComplete="email" />
                </label>
                <label>
                  Message
                  <textarea className="field mt-2 min-h-40" required />
                </label>
                <button className="btn-gold w-fit" type="submit">
                  Send Message <ArrowRight size={15} />
                </button>
              </form>
            )}
          </div>
          <aside className="grid content-start gap-4">
            <div className="contact-detail">
              <Mail />
              <div>
                <p>Email</p>
                <a href="mailto:support@qxtfunded.org">support@qxtfunded.org</a>
              </div>
            </div>
            <div className="contact-detail">
              <Clock3 />
              <div>
                <p>Response time</p>
                <b>Within one day</b>
              </div>
            </div>
            <div className="contact-detail">
              <MapPin />
              <div>
                <p>Availability</p>
                <b>Online worldwide · 24/7</b>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </Layout>
  );
}

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <Layout>
      <section className="page-hero hero-grid">
        <div className="container-x">
          <p className="eyebrow">Legal</p>
          <h1 className="section-title max-w-3xl">{document.title}</h1>
          <p className="mt-4 text-sm text-muted-foreground">Last updated: {document.updated}</p>
        </div>
      </section>
      <section className="section pt-0">
        <article className="legal-document container-x">
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </section>
    </Layout>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "register">(() => {
    if (typeof window === "undefined") return "login";
    return new URLSearchParams(window.location.search).get("mode") === "register"
      ? "register"
      : "login";
  });
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const authenticatedUser = await (mode === "login"
        ? loginUser({
            email: String(data.get("email") || ""),
            password: String(data.get("password") || ""),
          })
        : registerUser({
            name: [
              String(data.get("firstName") || "").trim(),
              String(data.get("lastName") || "").trim(),
            ]
              .filter(Boolean)
              .join(" "),
            email: String(data.get("email") || ""),
            password: String(data.get("password") || ""),
          }));
      if (!authenticatedUser)
        throw new Error("Unable to establish your session. Please try again.");
      setUser(authenticatedUser);
      const redirect = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      ).get("redirect");
      const destination = redirect || "/dashboard";
      if (destination.startsWith("/checkout/broker")) {
        const plan =
          new URL(destination, "http://local").searchParams.get("plan") || "instant-3000";
        navigate({ to: "/checkout/broker", search: { plan } });
      } else if (destination === "/forgot-password") {
        navigate({ to: "/forgot-password" });
      } else navigate({ to: "/dashboard" });
    } catch (caught) {
      if (caught instanceof ApiError && caught.accountStatus) {
        setError(
          caught.accountStatus === "pending"
            ? "Your account is currently Pending. Please wait until your account is activated."
            : caught.accountStatus === "suspended"
              ? "Your account has been Suspended. Please contact support for assistance."
              : "Your account has been Locked. Please contact support for assistance.",
        );
      } else {
        setError(caught instanceof Error ? caught.message : "Unable to authenticate.");
      }
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  return (
    <Layout minimal>
      <div className="auth-page">
        <div className="auth-form">
          <Logo />
          <div className="mt-16">
            <p className="eyebrow">Trader portal</p>
            <h1 className="mt-3 text-4xl font-semibold">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              Sign in to access your dashboard and orders.
            </p>
          </div>
          <form onSubmit={submit} className="mt-9 grid gap-5">
            {mode === "register" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <label>
                  First name
                  <input name="firstName" required className="field mt-2" placeholder="John" />
                </label>
                <label>
                  Last name
                  <input name="lastName" required className="field mt-2" placeholder="Smith" />
                </label>
              </div>
            )}
            <label>
              Email
              <input
                name="email"
                required
                type="email"
                className="field mt-2"
                placeholder="trader@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                required
                minLength={8}
                type="password"
                className="field mt-2"
                placeholder="At least 8 characters"
              />
            </label>
            <Link
              to="/forgot-password"
              className="-mt-2 inline-flex w-fit rounded-md border border-gold/40 px-3 py-2 text-sm font-medium text-gold hover:bg-gold/10 hover:text-foreground"
            >
              Forgot Password? Reset for $5
            </Link>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button className="btn-gold justify-center" type="submit" disabled={submitting}>
              {submitting
                ? mode === "register"
                  ? "Creating account..."
                  : "Signing in..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}{" "}
              {!submitting && <ArrowRight size={15} />}
            </button>
          </form>
          <button
            type="button"
            className="mt-7 text-sm text-gold"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
        <aside className="auth-aside">
          <blockquote>
            “The clearest rules and the fastest payouts of any firm I’ve traded with.”
          </blockquote>
          <p>Sarah P. — Funded Trader, UK</p>
          <div className="mt-12 grid gap-4">
            {["Instant setup", "Transparent rules", "92% split"].map((x) => (
              <span key={x}>
                <Check size={16} />
                {x}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </Layout>
  );
}

function PasswordResetShell({
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

export function ForgotPasswordPage() {
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [request, setRequest] = useState<PasswordResetRequest | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [hasPaid, setHasPaid] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadMethods = useCallback(async () => {
    setMethodsLoading(true);
    try {
      const loadedMethods = await getActivePaymentMethods();
      setMethods(loadedMethods);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load payment methods.");
    } finally {
      setMethodsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  const createRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const accountIdentifier = String(data.get("accountIdentifier") || "").trim();
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");
    const file = data.get("paymentProof");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("The new password must be at least 8 characters long.");
      return;
    }
    if (!selectedMethod) {
      setError("Select a payment method first.");
      return;
    }
    if (!(file instanceof File) || !file.size) {
      setError("A payment screenshot is required.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Payment proof must be 4 MB or smaller.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await createPasswordReset({
        accountIdentifier,
        newPassword,
        paymentMethodId: selectedMethod,
      });
      const submitted = await submitPasswordResetProof({
        requestId: created.request.id,
        accessToken: created.accessToken,
        transactionHash: String(data.get("transactionHash") || ""),
        paymentProof: file,
      });
      setRequest(submitted);
      setResetToken(created.accessToken);
      setMessage("Payment proof submitted. Wait for admin verification.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the reset request.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!request) return;
    const data = new FormData(event.currentTarget);
    const file = data.get("paymentProof");
    if (!(file instanceof File) || !file.size) {
      setError("A payment screenshot is required.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Payment proof must be 4 MB or smaller.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const updated = await submitPasswordResetProof({
        requestId: request.id,
        accessToken: resetToken,
        transactionHash: String(data.get("transactionHash") || ""),
        paymentProof: file,
      });
      setRequest(updated);
      setMessage("Payment proof submitted. Wait for admin verification.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit payment proof.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeMethod = methods.find(
    (method) => method.id === (request?.paymentMethodId || selectedMethod),
  );
  const reviewed = request && request.resetStatus !== "pending";
  return (
    <PasswordResetShell
      eyebrow="Secure account recovery"
      title="Reset funded-account password"
      copy="A $5 payment and admin approval are required before the password changes."
    >
      <div className="mt-10 max-w-2xl space-y-6">
        {request ? (
          <div className="order-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Reset request</p>
                <p className="mt-1 font-mono text-sm">#{request.id}</p>
              </div>
              <strong
                className={
                  request.resetStatus === "rejected"
                    ? "text-red-400"
                    : request.resetStatus === "approved"
                      ? "text-gold"
                      : "text-amber-300"
                }
              >
                {request.resetStatus === "approved"
                  ? "Approved"
                  : request.resetStatus === "rejected"
                    ? "Rejected"
                    : request.paymentProofId
                      ? "Pending Verification"
                      : "Payment Required"}
              </strong>
            </div>
            {request.resetStatus === "approved" ? (
              <p className="mt-5 text-sm text-gold">
                Your funded-account password was updated successfully.
              </p>
            ) : reviewed ? (
              <p className="mt-5 text-sm text-red-300">
                Payment rejected. Submit a new request to try again.
              </p>
            ) : request.paymentProofId ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Your proof is stored securely and awaiting admin review.
              </p>
            ) : (
              <form className="mt-6 grid gap-5" onSubmit={submitProof}>
                <p className="text-sm">
                  Send <b>$5 USD</b> using <b>{activeMethod?.name || request.paymentMethodName}</b>.
                </p>
                {activeMethod && (
                  <div className="rounded-md border border-border bg-muted p-3 text-sm">
                    <p>{activeMethod.instructions}</p>
                    <p className="mt-3 break-all font-mono text-xs">
                      {activeMethod.depositAddress}
                    </p>
                  </div>
                )}
                <label>
                  Payment proof
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
                  <input name="transactionHash" className="field mt-2" />
                </label>
                <button className="btn-gold w-fit" type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Payment Proof"}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="order-card grid gap-5">
            <div className="rounded-md border border-gold/30 bg-gold/10 p-4">
              <p className="font-semibold text-gold">Password Reset Fee: $5</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a payment method, then complete payment externally.
              </p>
            </div>
            {methodsLoading ? (
              <p className="text-sm text-muted-foreground">Loading payment methods...</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {methods.map((method) => (
                <button
                  type="button"
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`rounded-md border p-3 text-left ${selectedMethod === method.id ? "border-gold ring-1 ring-gold" : "border-border"}`}
                >
                  <b>{method.name}</b>
                  <span className="mt-1 block text-xs text-muted-foreground">{method.network}</span>
                </button>
              ))}
            </div>
            {activeMethod && (
              <div className="rounded-md border border-border bg-muted p-4 text-sm">
                <p>{activeMethod.instructions}</p>
                <p className="mt-3 break-all font-mono text-xs">{activeMethod.depositAddress}</p>
              </div>
            )}
            <button
              type="button"
              className="btn-gold w-fit"
              disabled={!selectedMethod}
              onClick={() => setHasPaid(true)}
            >
              I Have Paid
            </button>
            {hasPaid && (
              <form className="grid gap-5 border-t border-border pt-5" onSubmit={createRequest}>
                <label>
                  Account email
                  <input
                    name="accountIdentifier"
                    required
                    type="email"
                    className="field mt-2"
                    placeholder="customer-account@example.com"
                  />
                </label>
                <label>
                  New password
                  <input
                    name="newPassword"
                    required
                    minLength={8}
                    type="password"
                    className="field mt-2"
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    name="confirmPassword"
                    required
                    minLength={8}
                    type="password"
                    className="field mt-2"
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Payment proof
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
                  <input name="transactionHash" className="field mt-2" />
                </label>
                <button className="btn-gold w-fit" type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Reset Request"}
                </button>
              </form>
            )}
          </div>
        )}
        {(error || message) && (
          <p className={error ? "text-sm text-destructive" : "text-sm text-gold"}>
            {error || message}
          </p>
        )}
      </div>
    </PasswordResetShell>
  );
}

export function CheckoutPage() {
  const planId =
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("plan") ||
    "instant-3000";
  const { user, initializing } = useAuth();
  const next = `/checkout/broker?plan=${encodeURIComponent(planId)}`;
  const navigate = useNavigate();
  useEffect(() => {
    if (initializing) return;
    if (user) navigate({ to: "/checkout/broker", search: { plan: planId } });
    else navigate({ to: "/login", search: { redirect: next } });
  }, [initializing, navigate, next, planId, user]);
  return (
    <Layout>
      <section className="section">
        <div className="container-x max-w-xl">
          <p className="eyebrow">Secure checkout</p>
          <h1 className="mt-4 text-4xl font-semibold">Continue to checkout</h1>
          <p className="mt-3 text-muted-foreground">
            {initializing
              ? "Checking your session."
              : user
                ? "Continue to broker selection."
                : "Login or create an account before selecting your broker."}
          </p>
          <Link
            to={user ? "/checkout/broker" : "/login"}
            search={user ? { plan: planId } : { redirect: next }}
            className="btn-gold mt-7"
          >
            {initializing ? "Checking session" : user ? "Continue" : "Login / Sign Up"}{" "}
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
function CheckoutForm() {
  return null;
}

export function DashboardPage() {
  const [period, setPeriod] = useState("7D");
  const metrics: { Icon: LucideIcon; label: string; value: string }[] = [
    { Icon: Wallet, label: "Balance", value: "$20,842.50" },
    { Icon: TrendingUp, label: "Net profit", value: "+$842.50" },
    { Icon: BarChart3, label: "Profit target", value: "$2,000" },
    { Icon: ShieldCheck, label: "Daily drawdown", value: "$186 / $4,667" },
  ];
  const points =
    period === "7D"
      ? "12,42 62,30 112,48 160,39 210,84 262,70 315,105 365,79 420,120 470,95 525,135"
      : "12,100 62,79 112,93 160,60 210,110 262,88 315,124 365,106 420,145 470,125 525,155";
  return (
    <Layout>
      <section className="section">
        <div className="container-x">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Trader dashboard</p>
              <h1 className="truncate text-3xl font-semibold">Welcome back, Alex</h1>
            </div>
            <span className="active-badge">
              <i />
              Account active
            </span>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(({ Icon, label, value }) => (
              <div className="metric-card" key={label}>
                <Icon className="text-gold" size={20} />
                <p>{label}</p>
                <b>{value}</b>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
            <div className="chart-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Equity curve</p>
                  <b className="mt-1 block text-xl">$20,842.50</b>
                </div>
                <div className="segmented compact">
                  {["7D", "30D"].map((x) => (
                    <button
                      className={period === x ? "active" : ""}
                      onClick={() => setPeriod(x)}
                      key={x}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
              <svg
                viewBox="0 0 540 180"
                className="mt-8 w-full overflow-visible"
                aria-label="Equity chart"
              >
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="var(--gold)" stopOpacity=".3" />
                    <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`M${points} L525,175 L12,175Z`} fill="url(#chartFill)" />
                <polyline points={points} fill="none" stroke="var(--gold)" strokeWidth="3" />
              </svg>
            </div>
            <div className="chart-card">
              <p className="text-sm text-muted-foreground">Current account</p>
              <b className="mt-2 block text-3xl">$20,000</b>
              <p className="mt-1 text-sm text-gold">Instant Funding</p>
              <div className="mt-7 grid gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform</span>
                  <span>Quotex</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profit split</span>
                  <span>92%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trading days</span>
                  <span>14</span>
                </div>
              </div>
              <button className="btn-secondary mt-8 w-full">Request Payout</button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
