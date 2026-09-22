import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const plans = [
  [
    "instant-3000",
    "Instant",
    "$3,000",
    70,
    "$700",
    null,
    null,
    "Direct instant funded account",
    ["Up to 92% split", "Fast onboarding", "No evaluation delay"],
    false,
  ],
  [
    "instant-5000",
    "Instant",
    "$5,000",
    116,
    "$1,167",
    null,
    null,
    "Instant account with higher cash allocation",
    ["Up to 92% split", "Strong daily loss buffer", "Direct access"],
    false,
  ],
  [
    "instant-8000",
    "Instant",
    "$8,000",
    186,
    "$1,867",
    null,
    null,
    "Flexible capital for experienced traders",
    ["Fast access", "Dedicated trading environment"],
    false,
  ],
  [
    "instant-11000",
    "Instant",
    "$11,000",
    256,
    "$2,567",
    null,
    null,
    "High-volume, high-conviction account",
    ["High-capital trading", "Simple verification"],
    false,
  ],
  [
    "instant-15000",
    "Instant",
    "$15,000",
    349,
    "$3,500",
    null,
    null,
    "Built for disciplined execution",
    ["Flexible base size", "Optimized support"],
    false,
  ],
  [
    "instant-20000",
    "Instant",
    "$20,000",
    466,
    "$4,667",
    null,
    null,
    "Popular instant account option",
    ["Popular choice", "High capital access"],
    true,
  ],
  [
    "instant-25000",
    "Instant",
    "$25,000",
    582,
    "$5,833",
    null,
    null,
    "Mid-to-high scale account for traders",
    ["Balanced risk profile", "Wider flexibility"],
    false,
  ],
  [
    "instant-35000",
    "Instant",
    "$35,000",
    815,
    "$8,167",
    null,
    null,
    "Premium instant access",
    ["Higher buying power", "Premium support"],
    false,
  ],
  [
    "instant-50000",
    "Instant",
    "$50,000",
    1165,
    "$11,667",
    null,
    null,
    "Max-size direct funding account",
    ["Full capital access", "High-value pricing"],
    false,
  ],
  [
    "challenge-5000",
    "Challenge",
    "$5,000",
    49,
    "$250",
    "$500",
    "$500",
    "Entry-level challenge account",
    ["Low entry cost", "Clear challenge rules", "Up to 92% split"],
    false,
  ],
  [
    "challenge-10000",
    "Challenge",
    "$10,000",
    89,
    "$500",
    "$1,000",
    "$1,000",
    "Balanced challenge for traders",
    ["Transparent targets", "Strong risk controls"],
    true,
  ],
  [
    "challenge-25000",
    "Challenge",
    "$25,000",
    179,
    "$1,250",
    "$2,500",
    "$2,500",
    "Advanced challenge structure",
    ["Progressive pricing", "Professional framework"],
    false,
  ],
  [
    "challenge-50000",
    "Challenge",
    "$50,000",
    299,
    "$2,500",
    "$5,000",
    "$5,000",
    "High-cap challenge with stretched target",
    ["Large account size", "Structured evaluation rules"],
    false,
  ],
];

const brokers = [
  [
    "pocket-option",
    "Pocket Option",
    "/brokers/pocketoption.png",
    "Fast execution, wide instrument range",
  ],
  ["quotex", "Quotex", "/brokers/quotex.png", "Low-latency order routing"],
  ["binomo", "Binomo", "/brokers/binomo.png", "Clean charting, mobile-first"],
  ["olymp-trade", "Olymp Trade", "/brokers/olymptrade.png", "Established platform, deep liquidity"],
  ["tradowix", "Tradowix", "/brokers/tradowix.jpg", "Institutional grade speed, high reliability"],
];

const paymentMethods = [
  ["usdt-erc20", "USDT ERC20", "Ethereum (ERC-20)", "0x2eadfe3e50de0bf4bc9e8eb39bf5a2365246235d"],
  ["usdt-trc20", "USDT TRC20", "Tron (TRC-20)", "TTgAmyfoBEibSQEnEVR4iK52ZmmHi3haPp"],
  [
    "usdt-bep20",
    "USDT BEP20",
    "BNB Smart Chain (BEP-20)",
    "0x2eadfe3e50de0bf4bc9e8eb39bf5a2365246235d",
  ],
  ["bitcoin", "Bitcoin", "Bitcoin", "12cxf3jh5jncMXaA8jSXYzqg1yJxQxok2a"],
  ["ethereum", "Ethereum", "Ethereum", "0x2eadfe3e50de0bf4bc9e8eb39bf5a2365246235d"],
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD?.trim();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (!adminEmail || !adminPassword) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for database setup.");
}

async function ensureOrderColumns() {
  const columns = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders'",
  );
  const existing = new Set(columns.rows.map((row) => row.column_name));
  const additions = [
    ["payment_proof", "TEXT"],
    ["transaction_id", "TEXT"],
    ["rejection_reason", "TEXT"],
    ["approved_by", "UUID"],
    ["approved_at", "TIMESTAMPTZ"],
  ];

  for (const [columnName, dataType] of additions) {
    if (!existing.has(columnName)) {
      await pool.query(`ALTER TABLE orders ADD COLUMN ${columnName} ${dataType}`);
      existing.add(columnName);
    }
  }

  const foreignKeys = await pool.query(
    "SELECT conname FROM pg_constraint WHERE conrelid = 'public.orders'::regclass",
  );
  const names = new Set(foreignKeys.rows.map((row) => row.conname));
  if (!names.has("orders_approved_by_fkey")) {
    await pool.query(
      "ALTER TABLE orders ADD CONSTRAINT orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id)",
    );
  }
}

async function ensureOrderConstraints() {
  await pool.query("ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check");
  await pool.query(
    "ALTER TABLE orders ADD CONSTRAINT orders_order_status_check CHECK (order_status IN ('pending_verification', 'approved', 'rejected', 'active', 'payment_rejected'))",
  );
  await pool.query("ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check");
  await pool.query(
    "ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending', 'confirmed', 'rejected'))",
  );
}

async function ensurePasswordResetColumns() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      funded_account_id BIGINT NOT NULL REFERENCES funded_accounts(id) ON DELETE CASCADE,
      account_identifier TEXT NOT NULL,
      requested_password_encrypted TEXT NOT NULL,
      payment_method_id TEXT NOT NULL REFERENCES payment_methods(id),
      payment_method_name TEXT NOT NULL,
      network TEXT NOT NULL,
      deposit_address TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL DEFAULT 5.00 CHECK (amount = 5.00),
      currency TEXT NOT NULL DEFAULT 'USD',
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'rejected')),
      reset_status TEXT NOT NULL DEFAULT 'pending' CHECK (reset_status IN ('pending', 'approved', 'rejected')),
      transaction_id TEXT,
      payment_proof TEXT,
      payment_proof_name TEXT,
      payment_proof_mime_type TEXT,
      payment_proof_size_bytes INTEGER,
      rejection_reason TEXT,
      reviewed_by UUID REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS password_reset_requests_user_idx ON password_reset_requests(user_id, created_at DESC)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS password_reset_requests_status_idx ON password_reset_requests(reset_status, created_at DESC)",
  );
  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS password_reset_requests_pending_user_account_idx ON password_reset_requests(user_id, funded_account_id) WHERE reset_status = 'pending'",
  );
}

try {
  await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  await ensureOrderColumns();
  await ensureOrderConstraints();
  await ensurePasswordResetColumns();
  for (const [
    id,
    type,
    size,
    price,
    dailyLoss,
    target,
    drawdown,
    description,
    features,
    popular,
  ] of plans) {
    await pool.query(
      `INSERT INTO plans (id, type, size, price, daily_loss, target, drawdown, description, features, popular) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [
        id,
        type,
        size,
        price,
        dailyLoss,
        target,
        drawdown,
        description,
        JSON.stringify(features),
        popular,
      ],
    );
  }
  for (const [id, name, image, copy] of brokers) {
    await pool.query(
      `INSERT INTO brokers (id, name, image, copy) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [id, name, image, copy],
    );
  }
  for (const [id, name, network, address] of paymentMethods) {
    await pool.query(
      `INSERT INTO payment_methods (id, name, network, deposit_address, qr_data, instructions) VALUES ($1,$2,$3,$4,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [
        id,
        name,
        network,
        address,
        `Send the exact order amount using ${network}. Verify the network before sending.`,
      ],
    );
  }
  const hash = await bcrypt.hash(adminPassword, 12);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ('Admin User', $1, $2) ON CONFLICT (email) DO NOTHING RETURNING id`,
    [adminEmail, hash],
  );
  const adminUser =
    result.rows[0] ||
    (await pool.query("SELECT id FROM users WHERE email=$1", [adminEmail])).rows[0];
  if (!adminUser) throw new Error("Unable to initialize the configured admin user.");
  if (process.env.RESET_ADMIN_PASSWORD === "true") {
    await pool.query("UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2", [
      hash,
      adminUser.id,
    ]);
  }
  await pool.query("INSERT INTO admin_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [
    adminUser.id,
  ]);
  console.log("Database schema and seed complete.");
} finally {
  await pool.end();
}
