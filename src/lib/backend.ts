import { getCustomDirectPlanById } from "@/lib/qxt-data";

export type AccountStatus = "active" | "pending" | "suspended" | "locked";
export type PaymentStatus = "pending" | "confirmed" | "rejected";
export type OrderStatus =
  "pending" | "pending_verification" | "approved" | "rejected" | "active" | "payment_rejected";
export type VerificationStatus = "pending" | "verified" | "rejected";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  accountStatus: AccountStatus;
  admin: boolean;
  createdAt: string;
  lastLoginAt?: string;
};
export type AdminUser = PublicUser;
export type BrokerRecord = {
  id: string;
  name: string;
  enabled: boolean;
  image: string;
  copy: string;
};
export type PaymentMethod = {
  id: string;
  name: string;
  network: string;
  walletAddress: string;
  depositAddress: string;
  qrCode: string;
  enabled: boolean;
  instructions: string;
  minimumAmount?: number;
  maximumAmount?: number;
};
export type PlanRecord = {
  id: string;
  type: "Instant" | "Challenge";
  size: string;
  price: number;
  dailyLoss: string;
  target?: string;
  drawdown?: string;
  description: string;
  features: string[];
  active: boolean;
  popular?: boolean;
};
export type OrderRecord = {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  planPrice: number;
  brokerId: string;
  broker: string;
  paymentMethodId: string;
  paymentMethodName: string;
  network: string;
  walletAddress: string;
  depositAddress: string;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
  updatedAt: string;
  transactionHash?: string;
  paymentProof?: string;
  paymentProofName?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
};
export type AdminSummary = {
  totalUsers: number;
  totalOrders: number;
  totalSales: number;
  pendingOrders: number;
  approvedOrders: number;
  rejectedOrders: number;
  activeFundedAccounts: number;
};
export type FundedAccount = {
  id: string;
  orderId: string;
  email: string;
  password: string;
  createdAt: string;
};
export type ConnectionMode = "server" | "local";
export type ApiFailureKind = "network" | "timeout" | "http";

export type CurrentUserResult =
  | { status: "authenticated"; user: PublicUser }
  | { status: "restricted"; user: PublicUser }
  | { status: "unauthenticated"; user: null }
  | { status: "unavailable"; user: null };

export function isAccountRestricted(user: PublicUser | null | undefined) {
  return Boolean(user && user.accountStatus !== "active");
}

export class ApiError extends Error {
  readonly kind: ApiFailureKind;
  readonly status?: number;
  readonly accountStatus?: PublicUser["accountStatus"];
  readonly user?: PublicUser;

  constructor(
    message: string,
    kind: ApiFailureKind,
    status?: number,
    details?: { accountStatus?: PublicUser["accountStatus"]; user?: PublicUser },
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.accountStatus = details?.accountStatus;
    this.user = details?.user;
  }
}

type LocalAccountRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

const LOCAL_ACCOUNTS_KEY = "qxt-local-accounts";
const LOCAL_SESSION_KEY = "qxt-local-session";
const PENDING_PROFILE_KEY = "qxt-pending-profile-update";
let connectionMode: ConnectionMode = "server";
const connectionModeListeners = new Set<(mode: ConnectionMode) => void>();
const inFlightRequests = new Map<string, Promise<CacheResult<unknown>>>();
let pendingProfileSync: Promise<void> | null = null;

const API_URL = "";
const BACKEND_REQUEST_TIMEOUT_MS = 8000;

export type CacheResult<T> = {
  data: T;
  source: "server" | "cache";
  cachedAt?: number;
};

const CACHE_VERSION = 1;
export const CACHE_KEYS = {
  plans: "qxt-cache-plans",
  brokers: "qxt-cache-brokers",
  userProfile: "qxt-cache-user-profile",
  userOrders: (userId: string) => `qxt-cache-orders-${userId}`,
} as const;

export function getConnectionMode() {
  return connectionMode;
}

export function subscribeConnectionMode(listener: (mode: ConnectionMode) => void) {
  connectionModeListeners.add(listener);
  return () => {
    connectionModeListeners.delete(listener);
  };
}

function setConnectionMode(mode: ConnectionMode) {
  if (connectionMode === mode) return;
  connectionMode = mode;
  connectionModeListeners.forEach((listener) => listener(mode));
}

function readLocalAccounts(): LocalAccountRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_ACCOUNTS_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as LocalAccountRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: LocalAccountRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Local mode remains best effort when browser storage is unavailable.
  }
}

function toPublicLocalUser(account: LocalAccountRecord): PublicUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    accountStatus: "active",
    admin: false,
    createdAt: account.createdAt,
  };
}

export function getLocalSession(): PublicUser | null {
  if (typeof window === "undefined") return null;
  try {
    const session = JSON.parse(window.localStorage.getItem(LOCAL_SESSION_KEY) || "null");
    if (!session || typeof session.id !== "string" || typeof session.email !== "string")
      return null;
    return session as PublicUser;
  } catch {
    return null;
  }
}

type CachedUserProfile = Omit<PublicUser, "admin"> & { admin: false };

function cacheUserProfile(user: PublicUser) {
  if (!user.admin) {
    writeLocalCache<CachedUserProfile>(CACHE_KEYS.userProfile, { ...user, admin: false });
  }
}

function getCachedUserProfile() {
  return readLocalCache<CachedUserProfile>(CACHE_KEYS.userProfile);
}

type PendingProfileUpdate = {
  userId: string;
  name?: string;
  email?: string;
};

function getPendingProfileUpdate() {
  return readLocalCache<PendingProfileUpdate>(PENDING_PROFILE_KEY)?.data || null;
}

function clearPendingProfileUpdate() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_PROFILE_KEY);
  } catch {
    // Storage cleanup is best effort.
  }
}

async function syncPendingProfile(user: PublicUser) {
  const pending = getPendingProfileUpdate();
  if (!pending || pending.userId !== user.id || pendingProfileSync) return;
  pendingProfileSync = updateAccountSettings(pending)
    .then((updatedUser) => {
      cacheUserProfile(updatedUser);
      clearPendingProfileUpdate();
    })
    .catch(() => undefined)
    .finally(() => {
      pendingProfileSync = null;
    });
}

function setLocalSession(user: PublicUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    // Session persistence is best effort; the current page still has its user state.
  }
}

export function isLocalUser(user: PublicUser | null | undefined) {
  return Boolean(user?.id.startsWith("local-user-"));
}

async function hashLocalPassword(password: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function localSalt() {
  return globalThis.crypto.randomUUID();
}

async function createLocalAccount(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const accounts = readLocalAccounts();
  if (accounts.some((account) => account.email === email)) {
    throw new Error("An account with that email already exists locally.");
  }
  const salt = localSalt();
  const account: LocalAccountRecord = {
    id: `local-user-${globalThis.crypto.randomUUID()}`,
    name: input.name.trim(),
    email,
    passwordHash: await hashLocalPassword(input.password, salt),
    salt,
    createdAt: new Date().toISOString(),
  };
  writeLocalAccounts([...accounts, account]);
  const user = toPublicLocalUser(account);
  setLocalSession(user);
  setConnectionMode("local");
  return user;
}

async function loginLocalAccount(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  const account = readLocalAccounts().find((entry) => entry.email === email);
  if (!account || (await hashLocalPassword(password, account.salt)) !== account.passwordHash) {
    throw new Error("Invalid local email or password.");
  }
  const user = toPublicLocalUser(account);
  setLocalSession(user);
  setConnectionMode("local");
  return user;
}

async function updateLocalAccount(input: {
  name?: string;
  email?: string;
  password?: string;
  currentPassword?: string;
}) {
  const session = getLocalSession();
  if (!session || !isLocalUser(session)) throw new Error("Local account session not found.");
  const accounts = readLocalAccounts();
  const index = accounts.findIndex((account) => account.id === session.id);
  const account = accounts[index];
  if (!account) throw new Error("Local account was not found.");
  const nextEmail = input.email?.trim().toLowerCase() || account.email;
  if (accounts.some((entry, entryIndex) => entryIndex !== index && entry.email === nextEmail)) {
    throw new Error("An account with that email already exists locally.");
  }
  const nextAccount = { ...account, name: input.name?.trim() || account.name, email: nextEmail };
  if (input.password) {
    if (!input.currentPassword) throw new Error("Your current password is required.");
    const currentHash = await hashLocalPassword(input.currentPassword, account.salt);
    if (currentHash !== account.passwordHash) throw new Error("Current password is incorrect.");
    nextAccount.salt = localSalt();
    nextAccount.passwordHash = await hashLocalPassword(input.password, nextAccount.salt);
  }
  accounts[index] = nextAccount;
  writeLocalAccounts(accounts);
  const user = toPublicLocalUser(nextAccount);
  setLocalSession(user);
  setConnectionMode("local");
  return user;
}

type CacheEnvelope<T> = {
  version: number;
  savedAt: number;
  data: T;
};

export function readLocalCache<T>(key: string): { data: T; cachedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>;
    if (parsed.version !== CACHE_VERSION || typeof parsed.savedAt !== "number") return null;
    return { data: parsed.data as T, cachedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function writeLocalCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: CACHE_VERSION,
        savedAt: Date.now(),
        data,
      } satisfies CacheEnvelope<T>),
    );
  } catch {
    // Storage can be unavailable or full; the server-backed flow still works.
  }
}

async function serverFirstWithCache<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<CacheResult<T>> {
  const existing = inFlightRequests.get(key) as Promise<CacheResult<T>> | undefined;
  if (existing) return existing;
  const pending = (async () => {
    try {
      const data = await loader();
      writeLocalCache(key, data);
      return { data, source: "server" } as CacheResult<T>;
    } catch (error) {
      if (!isBackendUnavailable(error)) throw error;
      const cached = readLocalCache<T>(key);
      if (cached) return { data: cached.data, source: "cache", cachedAt: cached.cachedAt };
      throw error;
    } finally {
      inFlightRequests.delete(key);
    }
  })();
  inFlightRequests.set(key, pending as Promise<CacheResult<unknown>>);
  return pending;
}

function normalizePlainText(value: unknown): string {
  if (typeof value === "string") return value.trim().replace(/^['"]+|['"]+$/g, "");
  return String(value ?? "");
}

async function request<T>(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: options.signal || controller.signal,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
    setConnectionMode(getLocalSession() ? "local" : "server");
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(
        body.error || `Request failed (${response.status})`,
        "http",
        response.status,
        body,
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      setConnectionMode("local");
      throw new ApiError("The QXT API request timed out. Please try again.", "timeout");
    }
    if (error instanceof TypeError) {
      setConnectionMode("local");
      throw new ApiError(
        "Unable to reach the QXT API. Start the backend server and check that the frontend origin is allowed.",
        "network",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isBackendUnavailable(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.kind === "network" ||
      error.kind === "timeout" ||
      [502, 503, 504].includes(error.status || 0))
  );
}

function mapPlan(row: any): PlanRecord {
  return {
    id: normalizePlainText(row.id),
    type: row.type,
    size: row.size,
    price: Number(row.price),
    dailyLoss: row.daily_loss ?? row.dailyLoss,
    target: row.target,
    drawdown: row.drawdown,
    description: row.description,
    features: row.features || [],
    active: row.active,
    popular: row.popular,
  };
}
function mapBroker(row: any): BrokerRecord {
  return {
    id: normalizePlainText(row.id),
    name: row.name,
    enabled: row.enabled,
    image: row.image,
    copy: row.copy,
  };
}
function mapPaymentMethod(row: any): PaymentMethod {
  return {
    id: normalizePlainText(row.id),
    name: row.name,
    network: row.network,
    walletAddress: row.deposit_address ?? row.walletAddress,
    depositAddress: row.deposit_address ?? row.depositAddress,
    qrCode: row.qr_data ?? row.qrCode,
    enabled: row.enabled,
    instructions: row.instructions,
    minimumAmount: row.minimum_amount,
    maximumAmount: row.maximum_amount,
  };
}
function mapOrder(row: any): OrderRecord {
  return {
    id: normalizePlainText(row.id),
    userId: normalizePlainText(row.user_id ?? row.userId),
    planId: normalizePlainText(row.plan_id ?? row.planId),
    planName: row.plan_name ?? row.planName,
    planPrice: Number(row.plan_price ?? row.planPrice),
    brokerId: normalizePlainText(row.broker_id ?? row.brokerId),
    broker: row.broker_name ?? row.broker,
    paymentMethodId: normalizePlainText(row.payment_method_id ?? row.paymentMethodId),
    paymentMethodName: row.payment_method_name ?? row.paymentMethodName,
    network: row.network,
    walletAddress: row.deposit_address ?? row.walletAddress,
    depositAddress: row.deposit_address ?? row.depositAddress,
    amount: Number(row.amount),
    currency: row.currency,
    paymentStatus: row.payment_record_status ?? row.payment_status ?? row.paymentStatus,
    orderStatus: row.order_status ?? row.orderStatus,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    transactionHash: row.transaction_id ?? row.transactionHash,
    rejectionReason: row.rejection_reason ?? row.rejectionReason,
    paymentProof: row.payment_proof_id
      ? `/api/orders/${encodeURIComponent(normalizePlainText(row.id))}/payment-proof/${encodeURIComponent(normalizePlainText(row.payment_proof_id))}`
      : row.paymentProof,
    paymentProofName: row.payment_proof_name,
  };
}

export async function checkCurrentUser(): Promise<CurrentUserResult> {
  try {
    const result = await request<{ user: PublicUser }>("/api/auth/me");
    setLocalSession(null);
    setConnectionMode("server");
    cacheUserProfile(result.user);
    void syncPendingProfile(result.user);
    return { status: "authenticated", user: result.user };
  } catch (error) {
    const localSession = getLocalSession();
    if (isBackendUnavailable(error)) {
      if (localSession) {
        setConnectionMode("local");
        return { status: "authenticated", user: localSession };
      }
      const cachedProfile = getCachedUserProfile();
      if (cachedProfile) {
        setConnectionMode("local");
        return { status: "authenticated", user: cachedProfile.data };
      }
      return { status: "unavailable", user: null };
    }
    if (error instanceof ApiError && error.status === 401) {
      return { status: "unauthenticated", user: null };
    }
    if (error instanceof ApiError && error.accountStatus && error.user) {
      return { status: "restricted", user: error.user };
    }
    return { status: "unavailable", user: null };
  }
}
export async function getCurrentUser() {
  const result = await checkCurrentUser();
  return result.user;
}
export async function registerUser(input: { name: string; email: string; password: string }) {
  try {
    const result = await request<{ user: PublicUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setLocalSession(null);
    setConnectionMode("server");
    return result.user;
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    return createLocalAccount(input);
  }
}
export async function updateAccountSettings(input: {
  name?: string;
  email?: string;
  password?: string;
  currentPassword?: string;
}) {
  const result = await request<{ user: PublicUser }>("/api/auth/account", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return result.user;
}
export async function updateAccountSettingsWithFallback(input: {
  name?: string;
  email?: string;
  password?: string;
  currentPassword?: string;
}) {
  if (isLocalUser(getLocalSession())) return updateLocalAccount(input);
  try {
    return await updateAccountSettings(input);
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    if (input.password) throw new Error("Password changes require the backend.");
    const cached = getCachedUserProfile();
    if (!cached) throw error;
    const nextEmail = input.email?.trim().toLowerCase() || cached.data.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      throw new Error("Please enter a valid email address.");
    }
    const updatedProfile: CachedUserProfile = {
      ...cached.data,
      name: input.name?.trim() || cached.data.name,
      email: nextEmail,
      admin: false,
    };
    writeLocalCache(CACHE_KEYS.userProfile, updatedProfile);
    writeLocalCache<PendingProfileUpdate>(PENDING_PROFILE_KEY, {
      userId: cached.data.id,
      name: updatedProfile.name,
      email: updatedProfile.email,
    });
    setConnectionMode("local");
    return updatedProfile;
  }
}
export async function loginUser(input: { email: string; password: string }) {
  try {
    const result = await request<{ user: PublicUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setLocalSession(null);
    setConnectionMode("server");
    return result.user;
  } catch (error) {
    if (!isBackendUnavailable(error)) throw error;
    return loginLocalAccount(input.email, input.password);
  }
}
export async function logoutUser() {
  try {
    await request<void>("/api/auth/logout", { method: "POST" });
  } finally {
    setLocalSession(null);
  }
}
export async function getPlans() {
  const result = await request<{ plans: any[] }>("/api/plans");
  return result.plans.map(mapPlan);
}
export function getCachedPlans() {
  return readLocalCache<PlanRecord[]>(CACHE_KEYS.plans);
}
export function getPlansWithCache() {
  return serverFirstWithCache(CACHE_KEYS.plans, getPlans);
}
export async function getPlanById(id: string) {
  const customPlan = getCustomDirectPlanById(id);
  if (customPlan) {
    return {
      ...customPlan,
      description: "Custom direct funding account",
      features: ["Up to 92% split", "Instant funding", "Direct funding terms"],
      active: true,
    } as PlanRecord;
  }
  return (await getPlans()).find((plan) => plan.id === id) ?? null;
}
export async function getPlanByIdWithCache(id: string) {
  const customPlan = getCustomDirectPlanById(id);
  if (customPlan) {
    return {
      ...customPlan,
      description: "Custom direct funding account",
      features: ["Up to 92% split", "Instant funding", "Direct funding terms"],
      active: true,
    } as PlanRecord;
  }
  return (await getPlansWithCache()).data.find((plan) => plan.id === id) ?? null;
}
export async function getActiveBrokers() {
  const result = await request<{ brokers: any[] }>("/api/brokers");
  return result.brokers.map(mapBroker);
}
export function getCachedBrokers() {
  return readLocalCache<BrokerRecord[]>(CACHE_KEYS.brokers);
}
export function getActiveBrokersWithCache() {
  return serverFirstWithCache(CACHE_KEYS.brokers, getActiveBrokers);
}
export async function getActivePaymentMethods() {
  const result = await request<{ paymentMethods: any[] }>("/api/payment-methods");
  return result.paymentMethods.map(mapPaymentMethod);
}
export async function getAdminPlans() {
  const result = await request<{ plans: any[] }>("/api/admin/plans");
  return result.plans.map(mapPlan);
}
export async function getAdminBrokers() {
  const result = await request<{ brokers: any[] }>("/api/admin/brokers");
  return result.brokers.map(mapBroker);
}
export async function createAdminPlan(input: {
  id?: string;
  type: string;
  size: string;
  price: number;
  dailyLoss: string;
  target?: string;
  drawdown?: string;
  description: string;
  features?: string[];
  active?: boolean;
  popular?: boolean;
}) {
  const result = await request<{ plan: any }>("/api/admin/plans", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return mapPlan(result.plan);
}
export async function updateAdminPlan(input: {
  id: string;
  type?: string;
  size?: string;
  price?: number;
  dailyLoss?: string;
  target?: string;
  drawdown?: string;
  description?: string;
  features?: string[];
  active?: boolean;
  popular?: boolean;
}) {
  const result = await request<{ plan: any }>(`/api/admin/plans/${encodeURIComponent(input.id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return mapPlan(result.plan);
}
export async function deleteAdminPlan(id: string) {
  await request<void>(`/api/admin/plans/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function createAdminBroker(input: {
  id?: string;
  name: string;
  image: string;
  copy: string;
  enabled?: boolean;
}) {
  const result = await request<{ broker: any }>("/api/admin/brokers", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return mapBroker(result.broker);
}
export async function updateAdminBroker(input: {
  id: string;
  name?: string;
  image?: string;
  copy?: string;
  enabled?: boolean;
}) {
  const result = await request<{ broker: any }>(
    `/api/admin/brokers/${encodeURIComponent(input.id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return mapBroker(result.broker);
}
export async function deleteAdminBroker(id: string) {
  await request<void>(`/api/admin/brokers/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function createAdminPaymentMethod(input: {
  id?: string;
  name: string;
  network: string;
  depositAddress: string;
  qrData?: string;
  instructions?: string;
  enabled?: boolean;
  minimumAmount?: number;
  maximumAmount?: number;
}) {
  const result = await request<{ paymentMethod: any }>("/api/admin/payment-methods", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return mapPaymentMethod(result.paymentMethod);
}
export async function deleteAdminPaymentMethod(id: string) {
  await request<void>(`/api/admin/payment-methods/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function getPaymentMethodById(id: string) {
  return (await getActivePaymentMethods()).find((method) => method.id === id) ?? null;
}
export async function createOrUpdateCheckoutOrder(input: {
  planId: string;
  broker: string;
  paymentMethodId: string;
}) {
  const brokers = await getActiveBrokers();
  const broker = brokers.find((entry) => entry.name === input.broker || entry.id === input.broker);
  if (!broker) throw new Error("The selected broker is unavailable.");
  const result = await request<{ order: any }>("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      planId: input.planId,
      brokerId: broker.id,
      paymentMethodId: input.paymentMethodId,
    }),
  });
  return mapOrder(result.order);
}
export async function getOrderById(id: string) {
  const result = await request<{ order: any }>(`/api/orders/${encodeURIComponent(id)}`);
  return mapOrder(result.order);
}
export async function getOrdersForUser() {
  const result = await request<{ orders: any[] }>("/api/orders");
  return result.orders.map(mapOrder);
}
export function getCachedOrdersForUser(userId: string) {
  return readLocalCache<OrderRecord[]>(CACHE_KEYS.userOrders(userId));
}
export function getOrdersForUserWithCache(userId: string) {
  if (isLocalUser(getLocalSession())) {
    return Promise.resolve({
      data: getCachedOrdersForUser(userId)?.data || [],
      source: "cache",
    } satisfies CacheResult<OrderRecord[]>);
  }
  return serverFirstWithCache(CACHE_KEYS.userOrders(userId), getOrdersForUser);
}
export async function submitPaymentForOrder(input: {
  orderId: string;
  transactionHash?: string;
  paymentProof: File;
}) {
  const form = new FormData();
  form.append("paymentProof", input.paymentProof);
  if (input.transactionHash) form.append("transactionId", input.transactionHash);
  return request<{ status: string }>(
    `/api/orders/${encodeURIComponent(input.orderId)}/payment-proof`,
    { method: "POST", body: form },
  );
}
export async function getAllOrdersForAdmin() {
  const result = await request<{ orders: any[] }>("/api/admin/orders");
  return result.orders.map(mapOrder);
}
export async function getAdminPaymentMethods() {
  const result = await request<{ paymentMethods: any[] }>("/api/admin/payment-methods");
  return result.paymentMethods.map(mapPaymentMethod);
}
export async function updateAdminPaymentMethod(input: {
  id: string;
  name?: string;
  network?: string;
  depositAddress?: string;
  qrData?: string;
  instructions?: string;
  enabled?: boolean;
  minimumAmount?: number;
  maximumAmount?: number;
}) {
  const result = await request<{ paymentMethod: any }>(
    `/api/admin/payment-methods/${encodeURIComponent(input.id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return mapPaymentMethod(result.paymentMethod);
}
export async function getUsersForAdmin() {
  const result = await request<{ users: AdminUser[] }>("/api/admin/users");
  return result.users;
}
export async function updateAdminUser(input: {
  id: string;
  name: string;
  email: string;
  accountStatus: AccountStatus;
  password?: string;
}) {
  const result = await request<{ user: AdminUser }>(
    `/api/admin/users/${encodeURIComponent(input.id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return result.user;
}
export async function verifyOrderPayment(input: {
  orderId: string;
  approved: boolean;
  reason?: string;
}) {
  const path = input.approved ? "approve" : "reject";
  const body = input.approved ? {} : { reason: input.reason || "" };
  return request(`/api/admin/orders/${encodeURIComponent(input.orderId)}/${path}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
export async function approveOrderForAdmin(input: {
  orderId: string;
  accountEmail: string;
  accountPassword: string;
}) {
  return request<{ order: any; fundedAccount: any }>(
    `/api/admin/orders/${encodeURIComponent(input.orderId)}/approve`,
    {
      method: "PATCH",
      body: JSON.stringify({
        accountEmail: input.accountEmail,
        accountPassword: input.accountPassword,
      }),
    },
  );
}
export async function rejectOrderForAdmin(input: { orderId: string; reason?: string }) {
  return request<{ order: any }>(`/api/admin/orders/${encodeURIComponent(input.orderId)}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason: input.reason || "" }),
  });
}
export async function updateOrderStatusForAdmin(input: {
  orderId: string;
  status: "pending_verification" | "approved" | "rejected";
  reason?: string;
  accountEmail?: string;
  accountPassword?: string;
}) {
  return request<{ order: any }>(`/api/admin/orders/${encodeURIComponent(input.orderId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: input.status,
      reason: input.reason || "",
      accountEmail: input.accountEmail || "",
      accountPassword: input.accountPassword || "",
    }),
  });
}
export async function getAdminSummary() {
  const result = await request<{ summary: any }>("/api/admin/summary");
  return {
    totalUsers: Number(result.summary.total_users ?? result.summary.totalUsers ?? 0),
    totalOrders: Number(result.summary.total_orders ?? result.summary.totalOrders ?? 0),
    totalSales: Number(result.summary.total_sales ?? result.summary.totalSales ?? 0),
    pendingOrders: Number(result.summary.pending_orders ?? result.summary.pendingOrders ?? 0),
    approvedOrders: Number(result.summary.approved_orders ?? result.summary.approvedOrders ?? 0),
    rejectedOrders: Number(result.summary.rejected_orders ?? result.summary.rejectedOrders ?? 0),
    activeFundedAccounts: Number(
      result.summary.active_funded_accounts ?? result.summary.activeFundedAccounts ?? 0,
    ),
  };
}
export async function getFundedAccountForOrder(orderId: string) {
  const result = await request<{ fundedAccount: any }>(
    `/api/orders/${encodeURIComponent(orderId)}/funded-account`,
  );
  return result.fundedAccount;
}
export async function createOrder(input: {
  userId?: string;
  planId: string;
  broker: string;
  paymentMethodId: string;
  txId?: string;
  paymentProof?: string;
}) {
  const result = await request<{ order: any }>("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      planId: input.planId,
      brokerId: input.broker,
      paymentMethodId: input.paymentMethodId,
    }),
  });
  return mapOrder(result.order);
}
