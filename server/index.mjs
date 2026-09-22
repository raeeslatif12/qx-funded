import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import multer from "multer";
import pg from "pg";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { del as deleteBlob, get as getBlob, put as putBlob } from "@vercel/blob";

const { Pool } = pg;
const app = express();
const frontendOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i;
const sessionSecret = process.env.SESSION_SECRET;
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
const nodeEnvironment = process.env.NODE_ENV || "development";
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const useBlobStorage = Boolean(blobToken);
const maxUploadBytes = Number(
  process.env.MAX_UPLOAD_BYTES || (process.env.VERCEL ? 4 * 1024 * 1024 : 10 * 1024 * 1024),
);
const cookieSameSite = process.env.COOKIE_SAME_SITE || "lax";
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
if (!process.env.DATABASE_URL || !sessionSecret)
  throw new Error("DATABASE_URL and SESSION_SECRET are required.");
if (!process.env.FUNDED_ACCOUNT_ENCRYPTION_KEY)
  throw new Error("FUNDED_ACCOUNT_ENCRYPTION_KEY is required.");
if (nodeEnvironment === "production" && process.env.VERCEL && !blobToken)
  throw new Error("BLOB_READ_WRITE_TOKEN is required in production.");
if (!["lax", "strict", "none"].includes(cookieSameSite))
  throw new Error("COOKIE_SAME_SITE must be lax, strict, or none.");
if (cookieSameSite === "none" && nodeEnvironment !== "production")
  throw new Error("SameSite=None cookies require production HTTPS.");
if (!useBlobStorage) fs.mkdirSync(uploadDir, { recursive: true });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
});
pool.on("error", () => console.error("Unexpected idle PostgreSQL client error."));
const upload = multer({
  storage: useBlobStorage ? multer.memoryStorage() : multer.diskStorage({ destination: uploadDir }),
  limits: { fileSize: maxUploadBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, isAllowedUpload(file));
  },
});
app.set("trust proxy", 1);

if (!process.env.VERCEL) {
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || frontendOrigins.includes(origin) || localhostOriginPattern.test(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    }),
  );
}
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many authentication attempts. Please try again later." },
  }),
);
if (!useBlobStorage) app.use("/uploads", express.static(uploadDir));

function hashToken(token) {
  return crypto.createHmac("sha256", sessionSecret).update(token).digest("hex");
}
function createToken() {
  return crypto.randomBytes(32).toString("hex");
}
function encryptSecret(value) {
  const key = crypto
    .createHash("sha256")
    .update(process.env.FUNDED_ACCOUNT_ENCRYPTION_KEY)
    .digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}
function decryptSecret(value) {
  if (!value || typeof value !== "string") return "";
  const [ivHex, encryptedHex, tagHex] = value.split(":");
  if (!ivHex || !encryptedHex || !tagHex) return "";
  const key = crypto
    .createHash("sha256")
    .update(process.env.FUNDED_ACCOUNT_ENCRYPTION_KEY)
    .digest();
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
function safeDecryptSecret(value) {
  try {
    return decryptSecret(value);
  } catch {
    return "";
  }
}
function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    accountStatus: row.account_status,
    admin: Boolean(row.is_admin),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}
function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

function accountStatusMessage(status) {
  if (status === "pending") return "Your account is currently pending.";
  if (status === "suspended") return "Your account has been suspended.";
  if (status === "locked") return "Your account has been locked.";
  return "Your account is not currently active.";
}

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: cookieSameSite,
  secure: nodeEnvironment === "production",
  domain: cookieDomain,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function isAllowedUpload(file) {
  const extensionsByType = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
    "application/pdf": [".pdf"],
  };
  const extensions = extensionsByType[file.mimetype];
  return Boolean(extensions?.includes(path.extname(file.originalname).toLowerCase()));
}

async function storePaymentProof(file, ownerId, prefix = "payment-proofs") {
  if (!isAllowedUpload(file)) throw new Error("Unsupported payment proof file type.");
  if (useBlobStorage) {
    const extension = path.extname(file.originalname).toLowerCase() || ".bin";
    const blob = await putBlob(
      `${prefix}/${ownerId}/${crypto.randomUUID()}${extension}`,
      file.buffer,
      {
        access: "private",
        addRandomSuffix: false,
        contentType: file.mimetype,
        token: blobToken,
      },
    );
    return blob.pathname;
  }
  return `/uploads/${path.basename(file.path)}`;
}

async function auth(req, res, next) {
  try {
    const token = req.cookies.qxt_session;
    if (!token) return jsonError(res, 401, "Authentication required.");
    const result = await pool.query(
      `SELECT u.*, EXISTS(SELECT 1 FROM admin_users au WHERE au.user_id = u.id) AS is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()`,
      [hashToken(token)],
    );
    if (!result.rowCount) return jsonError(res, 401, "Session expired.");
    req.user = result.rows[0];
    if (!req.user.is_admin && req.user.account_status !== "active") {
      return res.status(403).json({
        error: accountStatusMessage(req.user.account_status),
        accountStatus: req.user.account_status,
        user: publicUser(req.user),
      });
    }
    await pool.query("UPDATE sessions SET last_seen_at=now() WHERE token_hash=$1", [
      hashToken(token),
    ]);
    next();
  } catch (error) {
    next(error);
  }
}

function adminOnly(req, res, next) {
  return req.user?.is_admin ? next() : jsonError(res, 403, "Admin access required.");
}
function audit(client, actor, action, entityType, entityId, metadata = {}) {
  return client.query(
    "INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)",
    [actor, action, entityType, entityId, JSON.stringify(metadata)],
  );
}

app.get("/health", async (_req, res) => {
  const result = await pool.query("SELECT 1 AS ok");
  res.json({ ok: result.rows[0].ok === 1, service: "qxt-api" });
});
app.get("/api/health", async (_req, res) => {
  const result = await pool.query("SELECT 1 AS ok");
  res.json({ ok: result.rows[0].ok === 1, service: "qxt-api" });
});

app.post("/api/auth/register", async (req, res, next) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 8)
    return jsonError(
      res,
      400,
      "Name, valid email and password of at least 8 characters are required.",
    );
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING *`,
      [String(name).trim(), String(email).trim().toLowerCase(), hash],
    );
    const token = createToken();
    await pool.query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,now()+interval '7 days')",
      [result.rows[0].id, hashToken(token)],
    );
    res.cookie("qxt_session", token, sessionCookieOptions);
    res.status(201).json({ user: publicUser({ ...result.rows[0], is_admin: false }) });
  } catch (error) {
    if (error.code === "23505")
      return jsonError(res, 409, "An account with that email already exists.");
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  const { email, password } = req.body || {};
  try {
    const result = await pool.query(
      `SELECT u.*, EXISTS(SELECT 1 FROM admin_users au WHERE au.user_id=u.id) AS is_admin FROM users u WHERE lower(email)=lower($1)`,
      [email],
    );
    if (!result.rowCount || !(await bcrypt.compare(password || "", result.rows[0].password_hash)))
      return jsonError(res, 401, "Invalid email or password.");
    const user = result.rows[0];
    if (!user.is_admin && user.account_status !== "active") {
      return res.status(403).json({
        error: accountStatusMessage(user.account_status),
        accountStatus: user.account_status,
        user: publicUser(user),
      });
    }
    const token = createToken();
    await pool.query("UPDATE users SET last_login_at=now(), updated_at=now() WHERE id=$1", [
      user.id,
    ]);
    await pool.query("DELETE FROM sessions WHERE expires_at <= now()");
    await pool.query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,now()+interval '7 days')",
      [user.id, hashToken(token)],
    );
    res.cookie("qxt_session", token, sessionCookieOptions);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const token = req.cookies.qxt_session;
    if (token) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [hashToken(token)]);
    res.clearCookie("qxt_session", sessionCookieOptions);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
app.get("/api/auth/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.patch("/api/auth/account", auth, async (req, res, next) => {
  try {
    const { name, email, password, currentPassword } = req.body || {};
    const updates = [];
    const values = [];

    if (typeof name === "string") {
      const nextName = name.trim();
      if (!nextName) return jsonError(res, 400, "Name cannot be empty.");
      updates.push("name = $" + (values.length + 1));
      values.push(nextName);
    }

    if (typeof email === "string") {
      const nextEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail))
        return jsonError(res, 400, "Please enter a valid email address.");
      const existing = await pool.query(
        "SELECT id FROM users WHERE lower(email)=lower($1) AND id <> $2",
        [nextEmail, req.user.id],
      );
      if (existing.rowCount)
        return jsonError(res, 409, "An account with that email already exists.");
      updates.push("email = $" + (values.length + 1));
      values.push(nextEmail);
    }

    if (typeof password === "string") {
      if (password.length < 8)
        return jsonError(res, 400, "New password must be at least 8 characters long.");
      if (typeof currentPassword !== "string" || !currentPassword)
        return jsonError(res, 400, "Your current password is required to change the password.");
      const validCurrent = await bcrypt.compare(currentPassword, req.user.password_hash);
      if (!validCurrent) return jsonError(res, 401, "Current password is incorrect.");
      const passwordHash = await bcrypt.hash(password, 12);
      updates.push("password_hash = $" + (values.length + 1));
      values.push(passwordHash);
    }

    if (updates.length === 0) return jsonError(res, 400, "No account changes were provided.");

    values.push(req.user.id);
    const statement = `UPDATE users SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(statement, values);
    const user = result.rows[0];
    res.json({ user: publicUser({ ...user, is_admin: Boolean(req.user.is_admin) }) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/plans", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM plans WHERE active=true AND id NOT LIKE 'custom-direct-%' ORDER BY type, price",
    );
    res.json({ plans: result.rows });
  } catch (error) {
    next(error);
  }
});
app.get("/api/brokers", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id,name,image,copy,enabled FROM brokers WHERE enabled=true ORDER BY name",
    );
    res.json({ brokers: result.rows });
  } catch (error) {
    next(error);
  }
});
app.get("/api/payment-methods", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id,name,network,deposit_address,enabled,qr_data,instructions,minimum_amount,maximum_amount FROM payment_methods WHERE enabled=true ORDER BY name",
    );
    res.json({ paymentMethods: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/plans", auth, adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM plans ORDER BY type, price");
    res.json({ plans: result.rows });
  } catch (error) {
    next(error);
  }
});
app.post("/api/admin/plans", auth, adminOnly, async (req, res, next) => {
  try {
    const body = req.body || {};
    const type = String(body.type || "Instant").trim();
    const price = Number(body.price ?? 0);
    let size = String(body.size || "").trim();
    let dailyLoss = String(body.dailyLoss || "").trim();
    let description = String(body.description || "").trim();
    if (type === "Instant" && Number.isFinite(price) && price >= 10) {
      const fundingSize = Math.round(price * (3000 / 70) * 100) / 100;
      size = formatUsd(fundingSize);
      dailyLoss = formatUsd((fundingSize * 7) / 30);
      description = description || "Direct instant funded account";
    }
    if (!size || !description || !dailyLoss || !Number.isFinite(price))
      return jsonError(
        res,
        400,
        "Enter a valid plan price and complete the Challenge plan fields.",
      );
    const id = String(
      body.id || `${type.toLowerCase()}-${size.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    ).trim();
    const target = body.target == null ? null : String(body.target).trim();
    const drawdown = body.drawdown == null ? null : String(body.drawdown).trim();
    const features = Array.isArray(body.features) ? body.features.map((item) => String(item)) : [];
    const result = await pool.query(
      `INSERT INTO plans (id, type, size, price, daily_loss, target, drawdown, description, features, active, popular) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type, size=EXCLUDED.size, price=EXCLUDED.price, daily_loss=EXCLUDED.daily_loss, target=EXCLUDED.target, drawdown=EXCLUDED.drawdown, description=EXCLUDED.description, features=EXCLUDED.features, active=EXCLUDED.active, popular=EXCLUDED.popular, updated_at=now() RETURNING *`,
      [
        id,
        type,
        size,
        price,
        dailyLoss,
        target || null,
        drawdown || null,
        description,
        JSON.stringify(features),
        Boolean(body.active ?? true),
        Boolean(body.popular ?? false),
      ],
    );
    res.status(201).json({ plan: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
app.patch("/api/admin/plans/:id", auth, adminOnly, async (req, res, next) => {
  try {
    const id = req.params.id;
    const updates = [];
    const values = [];
    const fieldMap = {
      type: "type",
      size: "size",
      price: "price",
      dailyLoss: "daily_loss",
      target: "target",
      drawdown: "drawdown",
      description: "description",
      features: "features",
      active: "active",
      popular: "popular",
    };
    for (const [inputKey, columnKey] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(req.body, inputKey)) {
        updates.push(`${columnKey} = $${values.length + 1}`);
        values.push(
          inputKey === "features"
            ? JSON.stringify(
                Array.isArray(req.body.features)
                  ? req.body.features.map((item) => String(item))
                  : [],
              )
            : req.body[inputKey],
        );
      }
    }
    if (!updates.length) return jsonError(res, 400, "No plan changes were provided.");
    values.push(id);
    const result = await pool.query(
      `UPDATE plans SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rowCount) return jsonError(res, 404, "Plan not found.");
    res.json({ plan: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
app.delete("/api/admin/plans/:id", auth, adminOnly, async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM plans WHERE id = $1 RETURNING id", [
      req.params.id,
    ]);
    if (!result.rowCount) return jsonError(res, 404, "Plan not found.");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/brokers", auth, adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM brokers ORDER BY name");
    res.json({ brokers: result.rows });
  } catch (error) {
    next(error);
  }
});
app.post("/api/admin/brokers", auth, adminOnly, async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const image = String(body.image || "").trim();
    const copy = String(body.copy || "").trim();
    if (!name || !image || !copy)
      return jsonError(res, 400, "Broker name, image, and description are required.");
    const id = String(body.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim();
    const result = await pool.query(
      `INSERT INTO brokers (id, name, image, copy, enabled) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, image=EXCLUDED.image, copy=EXCLUDED.copy, enabled=EXCLUDED.enabled, updated_at=now() RETURNING *`,
      [id, name, image, copy, Boolean(body.enabled ?? true)],
    );
    res.status(201).json({ broker: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
app.patch("/api/admin/brokers/:id", auth, adminOnly, async (req, res, next) => {
  try {
    const updates = [];
    const values = [];
    for (const [inputKey, columnKey] of [
      ["name", "name"],
      ["image", "image"],
      ["copy", "copy"],
      ["enabled", "enabled"],
    ]) {
      if (Object.prototype.hasOwnProperty.call(req.body, inputKey)) {
        updates.push(`${columnKey} = $${values.length + 1}`);
        values.push(req.body[inputKey]);
      }
    }
    if (!updates.length) return jsonError(res, 400, "No broker changes were provided.");
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE brokers SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rowCount) return jsonError(res, 404, "Broker not found.");
    res.json({ broker: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
app.delete("/api/admin/brokers/:id", auth, adminOnly, async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM brokers WHERE id = $1 RETURNING id", [
      req.params.id,
    ]);
    if (!result.rowCount) return jsonError(res, 404, "Broker not found.");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/payment-methods", auth, adminOnly, async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const network = String(body.network || "").trim();
    const depositAddress = String(body.depositAddress || body.deposit_address || "").trim();
    if (!name || !network || !depositAddress)
      return jsonError(res, 400, "Payment method name, network, and deposit address are required.");
    const id = String(body.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim();
    const result = await pool.query(
      `INSERT INTO payment_methods (id, name, network, deposit_address, qr_data, instructions, enabled, minimum_amount, maximum_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, network=EXCLUDED.network, deposit_address=EXCLUDED.deposit_address, qr_data=EXCLUDED.qr_data, instructions=EXCLUDED.instructions, enabled=EXCLUDED.enabled, minimum_amount=EXCLUDED.minimum_amount, maximum_amount=EXCLUDED.maximum_amount, updated_at=now() RETURNING *`,
      [
        id,
        name,
        network,
        depositAddress,
        String(body.qrData || body.qr_data || depositAddress),
        String(body.instructions || `Send the exact order amount using ${network}.`),
        Boolean(body.enabled ?? true),
        body.minimumAmount ?? null,
        body.maximumAmount ?? null,
      ],
    );
    res.status(201).json({ paymentMethod: result.rows[0] });
  } catch (error) {
    next(error);
  }
});
app.delete("/api/admin/payment-methods/:id", auth, adminOnly, async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM payment_methods WHERE id = $1 RETURNING id", [
      req.params.id,
    ]);
    if (!result.rowCount) return jsonError(res, 404, "Payment method not found.");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const orderSelect = `SELECT o.*, p.status AS payment_record_status, p.transaction_id, p.submitted_at, p.verified_at, pp.id AS payment_proof_id, pp.storage_path AS payment_proof, pp.original_name AS payment_proof_name FROM orders o LEFT JOIN payments p ON p.order_id=o.id LEFT JOIN LATERAL (SELECT * FROM payment_proofs WHERE payment_id=p.id ORDER BY created_at DESC LIMIT 1) pp ON true`;
const orderDetailSelect = `SELECT o.*, p.status AS payment_record_status, p.transaction_id, p.submitted_at, p.verified_at, pp.id AS payment_proof_id, pp.storage_path AS payment_proof, pp.original_name AS payment_proof_name FROM orders o LEFT JOIN payments p ON p.order_id=o.id LEFT JOIN LATERAL (SELECT * FROM payment_proofs WHERE payment_id=p.id ORDER BY created_at DESC LIMIT 1) pp ON true`;

function formatUsd(value) {
  const rounded = Math.round(value * 100) / 100;
  return `$${rounded.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function customDirectPlanFromId(planId) {
  const match = /^custom-direct-(\d+)$/.exec(String(planId || ""));
  if (!match) return null;
  const cents = Number(match[1]);
  if (!Number.isSafeInteger(cents) || cents < 1000) return null;
  const amount = cents / 100;
  const fundingSize = Math.round(amount * (3000 / 70) * 100) / 100;
  return {
    id: `custom-direct-${cents}`,
    type: "Instant",
    size: formatUsd(fundingSize),
    price: amount,
    dailyLoss: formatUsd((fundingSize * 7) / 30),
    description: "Custom direct funding account",
    features: ["Up to 92% split", "Instant funding", "Direct funding terms"],
  };
}

app.post("/api/orders", auth, async (req, res, next) => {
  const { planId, brokerId, paymentMethodId } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const customPlan = customDirectPlanFromId(planId);
    const [plan, broker, method] = await Promise.all([
      customPlan
        ? client.query(
            `INSERT INTO plans (id,type,size,price,daily_loss,description,features,active,popular)
             VALUES ($1,$2,$3,$4,$5,$6,$7,true,false)
             ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type,size=EXCLUDED.size,price=EXCLUDED.price,daily_loss=EXCLUDED.daily_loss,description=EXCLUDED.description,features=EXCLUDED.features,active=true,updated_at=now()
             RETURNING *`,
            [
              customPlan.id,
              customPlan.type,
              customPlan.size,
              customPlan.price,
              customPlan.dailyLoss,
              customPlan.description,
              JSON.stringify(customPlan.features),
            ],
          )
        : client.query("SELECT * FROM plans WHERE id=$1 AND active=true", [planId]),
      client.query("SELECT * FROM brokers WHERE id=$1 AND enabled=true", [brokerId]),
      client.query("SELECT * FROM payment_methods WHERE id=$1 AND enabled=true", [paymentMethodId]),
    ]);
    if (!plan.rowCount || !broker.rowCount || !method.rowCount) {
      await client.query("ROLLBACK");
      return jsonError(res, 400, "Plan, broker or payment method is unavailable.");
    }
    const p = plan.rows[0],
      b = broker.rows[0],
      m = method.rows[0];
    const planName = p.id.startsWith("custom-direct-")
      ? `Custom Direct Funding — ${formatUsd(Number(p.price))} → ${p.size}`
      : p.size;
    const order = await client.query(
      `INSERT INTO orders (user_id,plan_id,plan_name,plan_price,broker_id,broker_name,payment_method_id,payment_method_name,network,deposit_address,amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$4) RETURNING *`,
      [
        req.user.id,
        p.id,
        planName,
        p.price,
        b.id,
        b.name,
        m.id,
        m.name,
        m.network,
        m.deposit_address,
      ],
    );
    const payment = await client.query(
      "INSERT INTO payments (order_id,amount) VALUES ($1,$2) RETURNING id",
      [order.rows[0].id, p.price],
    );
    await audit(client, req.user.id, "order.created", "order", order.rows[0].id, {
      planId: p.id,
      brokerId: b.id,
      paymentMethodId: m.id,
    });
    await client.query("COMMIT");
    res.status(201).json({ order: { ...order.rows[0], paymentId: payment.rows[0].id } });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/orders", auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `${orderSelect} WHERE o.user_id=$1 ORDER BY o.created_at DESC`,
      [req.user.id],
    );
    res.json({ orders: result.rows });
  } catch (error) {
    next(error);
  }
});
app.get("/api/orders/:id", auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `${orderDetailSelect} WHERE o.id=$1 AND (o.user_id=$2 OR EXISTS(SELECT 1 FROM admin_users WHERE user_id=$2))`,
      [req.params.id, req.user.id],
    );
    if (!result.rowCount) return jsonError(res, 404, "Order not found.");
    res.json({ order: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders/:id/funded-account", auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT fa.*, o.user_id, o.order_status FROM funded_accounts fa JOIN orders o ON o.id=fa.order_id WHERE fa.order_id=$1 AND o.user_id=$2 AND o.order_status IN ('approved', 'active')`,
      [req.params.id, req.user.id],
    );
    if (!result.rowCount)
      return jsonError(res, 404, "Funded account not found or not available to this user.");
    const account = result.rows[0];
    res.json({
      fundedAccount: {
        id: account.id,
        orderId: account.order_id,
        email: account.account_email,
        password: safeDecryptSecret(account.account_password_encrypted),
        createdAt: account.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders/:id/payment-proof/:proofId", auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT pp.storage_path, pp.original_name, pp.mime_type
       FROM payment_proofs pp
       JOIN payments p ON p.id=pp.payment_id
       JOIN orders o ON o.id=p.order_id
       WHERE pp.id=$1 AND o.id=$2 AND (o.user_id=$3 OR EXISTS(SELECT 1 FROM admin_users WHERE user_id=$3))`,
      [req.params.proofId, req.params.id, req.user.id],
    );
    if (!result.rowCount) return jsonError(res, 404, "Payment proof not found.");
    const proof = result.rows[0];
    if (!useBlobStorage) {
      const filename = path.basename(proof.storage_path);
      return res.sendFile(filename, {
        root: uploadDir,
        headers: { "Content-Disposition": "inline" },
      });
    }
    const blob = await getBlob(proof.storage_path, { access: "private", token: blobToken });
    if (!blob || !blob.stream) return jsonError(res, 404, "Payment proof not found.");
    res.status(200);
    res.setHeader("Content-Type", proof.mime_type);
    const safeFilename = path.basename(proof.original_name).replace(/[\r\n"]/g, "");
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    return Readable.fromWeb(blob.stream).pipe(res);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/orders/:id/payment-proof",
  auth,
  upload.single("paymentProof"),
  async (req, res, next) => {
    if (!req.file) return jsonError(res, 400, "Payment screenshot is required.");
    let storedProofPath;
    let previousProofPaths = [];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        "SELECT o.*, p.id AS payment_id FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=$1 AND o.user_id=$2 FOR UPDATE",
        [req.params.id, req.user.id],
      );
      if (!found.rowCount) {
        await client.query("ROLLBACK");
        return jsonError(res, 404, "Order not found.");
      }
      const order = found.rows[0];
      const previous = await client.query(
        "SELECT storage_path FROM payment_proofs WHERE payment_id=$1 ORDER BY created_at DESC",
        [order.payment_id],
      );
      previousProofPaths = previous.rows.map((row) => row.storage_path);
      const proofPath = await storePaymentProof(req.file, req.params.id);
      storedProofPath = proofPath;
      await client.query("DELETE FROM payment_proofs WHERE payment_id=$1", [order.payment_id]);
      const proof = await client.query(
        "INSERT INTO payment_proofs (payment_id,storage_path,original_name,mime_type,size_bytes) VALUES ($1,$2,$3,$4,$5) RETURNING id,storage_path,original_name,mime_type,size_bytes,created_at",
        [order.payment_id, proofPath, req.file.originalname, req.file.mimetype, req.file.size],
      );
      await client.query(
        "UPDATE payments SET transaction_id=$1,status='pending',submitted_at=now(),updated_at=now() WHERE id=$2",
        [req.body.transactionId || null, order.payment_id],
      );
      await client.query(
        "UPDATE orders SET payment_status='pending',order_status='pending_verification',transaction_id=$1,payment_proof=$2,updated_at=now() WHERE id=$3",
        [req.body.transactionId || null, proofPath, req.params.id],
      );
      await client.query("COMMIT");
      void audit(pool, req.user.id, "payment.proof_submitted", "order", req.params.id).catch(
        () => undefined,
      );
      const proofRecord = proof.rows[0];
      for (const previousProofPath of previousProofPaths) {
        if (useBlobStorage && previousProofPath !== proofRecord.storage_path) {
          await deleteBlob(previousProofPath, { token: blobToken }).catch(() => undefined);
        } else if (!useBlobStorage && previousProofPath !== proofRecord.storage_path) {
          await fs.promises.unlink(previousProofPath).catch(() => undefined);
        }
      }
      res.status(201).json({
        status: "pending_verification",
        order: {
          id: req.params.id,
          paymentStatus: "pending",
          orderStatus: "pending_verification",
        },
        paymentProof: {
          id: proofRecord.id,
          originalName: proofRecord.original_name,
          mimeType: proofRecord.mime_type,
          sizeBytes: proofRecord.size_bytes,
          createdAt: proofRecord.created_at,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      if (!useBlobStorage && req.file?.path)
        await fs.promises.unlink(req.file.path).catch(() => undefined);
      if (useBlobStorage && storedProofPath)
        await deleteBlob(storedProofPath, { token: blobToken }).catch(() => undefined);
      next(error);
    } finally {
      client.release();
    }
  },
);

function publicPasswordReset(row) {
  return {
    id: String(row.id),
    userId: row.user_id,
    fundedAccountId: String(row.funded_account_id),
    accountIdentifier: row.account_identifier,
    amount: Number(row.amount),
    currency: row.currency,
    paymentMethodId: row.payment_method_id,
    paymentMethodName: row.payment_method_name,
    network: row.network,
    paymentStatus: row.payment_status,
    resetStatus: row.reset_status,
    transactionId: row.transaction_id,
    paymentProofId: row.payment_proof ? String(row.id) : null,
    paymentProofName: row.payment_proof_name,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
    userName: row.user_name,
    userEmail: row.user_email,
    orderId: row.order_id ? String(row.order_id) : undefined,
    brokerName: row.broker_name,
  };
}

app.get("/api/password-resets", auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, fa.order_id, o.broker_name
       FROM password_reset_requests pr
       JOIN funded_accounts fa ON fa.id=pr.funded_account_id
       JOIN orders o ON o.id=fa.order_id
       WHERE pr.user_id=$1 ORDER BY pr.created_at DESC`,
      [req.user.id],
    );
    res.json({ passwordResets: result.rows.map(publicPasswordReset) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/password-resets", auth, async (req, res, next) => {
  const identifier = String(req.body?.accountIdentifier || "").trim();
  const newPassword = String(req.body?.newPassword || "");
  const paymentMethodId = String(req.body?.paymentMethodId || "").trim();
  if (!identifier || newPassword.length < 8 || newPassword.length > 256 || !paymentMethodId)
    return jsonError(
      res,
      400,
      "Account identifier, payment method, and a valid new password are required.",
    );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const account = await client.query(
      `SELECT fa.id, fa.order_id, o.order_status
       FROM funded_accounts fa JOIN orders o ON o.id=fa.order_id
       WHERE fa.user_id=$1 AND lower(fa.account_email)=lower($2) AND o.order_status IN ('approved','active')
       FOR UPDATE`,
      [req.user.id, identifier],
    );
    if (!account.rowCount)
      return await rollbackError(
        client,
        res,
        404,
        "No active funded account matches that identifier.",
      );
    const existing = await client.query(
      "SELECT id,reset_status FROM password_reset_requests WHERE user_id=$1 AND funded_account_id=$2 AND reset_status='pending'",
      [req.user.id, account.rows[0].id],
    );
    if (existing.rowCount)
      return await rollbackError(
        client,
        res,
        409,
        "A password reset payment is already pending for this account.",
      );
    const method = await client.query(
      "SELECT * FROM payment_methods WHERE id=$1 AND enabled=true",
      [paymentMethodId],
    );
    if (!method.rowCount)
      return await rollbackError(client, res, 400, "Payment method is unavailable.");
    const m = method.rows[0];
    const result = await client.query(
      `INSERT INTO password_reset_requests
       (user_id,funded_account_id,account_identifier,requested_password_encrypted,payment_method_id,payment_method_name,network,deposit_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        req.user.id,
        account.rows[0].id,
        identifier,
        encryptSecret(newPassword),
        m.id,
        m.name,
        m.network,
        m.deposit_address,
      ],
    );
    await audit(client, req.user.id, "password_reset.created", "password_reset", result.rows[0].id);
    await client.query("COMMIT");
    res.status(201).json({ passwordReset: publicPasswordReset(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505")
      return jsonError(res, 409, "A password reset payment is already pending for this account.");
    next(error);
  } finally {
    client.release();
  }
});

app.post(
  "/api/password-resets/:id/payment-proof",
  auth,
  upload.single("paymentProof"),
  async (req, res, next) => {
    if (!req.file) return jsonError(res, 400, "Payment screenshot is required.");
    let storedProofPath;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        "SELECT * FROM password_reset_requests WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [req.params.id, req.user.id],
      );
      if (!found.rowCount)
        return await rollbackError(client, res, 404, "Password reset request not found.");
      if (found.rows[0].reset_status !== "pending")
        return await rollbackError(
          client,
          res,
          409,
          "This password reset request is no longer pending.",
        );
      storedProofPath = await storePaymentProof(req.file, req.params.id, "password-reset-proofs");
      await client.query(
        `UPDATE password_reset_requests
         SET payment_status='pending',transaction_id=$1,payment_proof=$2,payment_proof_name=$3,
             payment_proof_mime_type=$4,payment_proof_size_bytes=$5,updated_at=now()
         WHERE id=$6`,
        [
          req.body.transactionId || null,
          storedProofPath,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          req.params.id,
        ],
      );
      const updated = await client.query("SELECT * FROM password_reset_requests WHERE id=$1", [
        req.params.id,
      ]);
      await audit(
        client,
        req.user.id,
        "password_reset.proof_submitted",
        "password_reset",
        req.params.id,
      );
      await client.query("COMMIT");
      res.status(201).json({ passwordReset: publicPasswordReset(updated.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK");
      if (useBlobStorage && storedProofPath)
        await deleteBlob(storedProofPath, { token: blobToken }).catch(() => undefined);
      next(error);
    } finally {
      client.release();
    }
  },
);

app.get("/api/admin/password-resets", auth, adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, u.name AS user_name, u.email AS user_email, fa.order_id, o.broker_name
       FROM password_reset_requests pr
       JOIN users u ON u.id=pr.user_id
       JOIN funded_accounts fa ON fa.id=pr.funded_account_id
       JOIN orders o ON o.id=fa.order_id
       ORDER BY pr.created_at DESC`,
    );
    res.json({ passwordResets: result.rows.map(publicPasswordReset) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/password-resets/:id/payment-proof", auth, adminOnly, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT payment_proof,payment_proof_name,payment_proof_mime_type FROM password_reset_requests WHERE id=$1",
      [req.params.id],
    );
    if (!result.rowCount || !result.rows[0].payment_proof)
      return jsonError(res, 404, "Payment proof not found.");
    const proof = result.rows[0];
    if (!useBlobStorage) {
      return res.sendFile(path.basename(proof.payment_proof), {
        root: uploadDir,
        headers: { "Content-Disposition": "inline" },
      });
    }
    const blob = await getBlob(proof.payment_proof, { access: "private", token: blobToken });
    if (!blob?.stream) return jsonError(res, 404, "Payment proof not found.");
    res.setHeader("Content-Type", proof.payment_proof_mime_type);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${path.basename(proof.payment_proof_name).replace(/[\r\n"]/g, "")}"`,
    );
    return Readable.fromWeb(blob.stream).pipe(res);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/password-resets/:id/status", auth, adminOnly, async (req, res, next) => {
  const targetStatus = req.body?.status;
  if (!["approved", "rejected"].includes(targetStatus))
    return jsonError(res, 400, "Invalid password reset status.");
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT pr.*, u.account_status, fa.account_password_encrypted, o.order_status
       FROM password_reset_requests pr
       JOIN users u ON u.id=pr.user_id
       JOIN funded_accounts fa ON fa.id=pr.funded_account_id
       JOIN orders o ON o.id=fa.order_id WHERE pr.id=$1 FOR UPDATE`,
      [req.params.id],
    );
    if (!found.rowCount)
      return await rollbackError(client, res, 404, "Password reset request not found.");
    const reset = found.rows[0];
    if (reset.reset_status !== "pending")
      return await rollbackError(
        client,
        res,
        409,
        "This password reset request was already reviewed.",
      );
    if (targetStatus === "approved") {
      if (
        reset.payment_status !== "pending" ||
        !reset.payment_proof ||
        reset.account_status !== "active" ||
        !["approved", "active"].includes(reset.order_status)
      )
        return await rollbackError(
          client,
          res,
          409,
          "This reset request is not eligible for approval.",
        );
      await client.query(
        "UPDATE funded_accounts SET account_password_encrypted=$1,updated_at=now() WHERE id=$2",
        [reset.requested_password_encrypted, reset.funded_account_id],
      );
      await client.query(
        "UPDATE password_reset_requests SET payment_status='confirmed',reset_status='approved',reviewed_by=$1,reviewed_at=now(),updated_at=now() WHERE id=$2",
        [req.user.id, req.params.id],
      );
    } else {
      await client.query(
        "UPDATE password_reset_requests SET payment_status='rejected',reset_status='rejected',rejection_reason=$1,reviewed_by=$2,reviewed_at=now(),updated_at=now() WHERE id=$3",
        [reason, req.user.id, req.params.id],
      );
    }
    await audit(
      client,
      req.user.id,
      `password_reset.${targetStatus}`,
      "password_reset",
      req.params.id,
    );
    await client.query("COMMIT");
    res.json({ status: targetStatus });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/admin/payment-methods", auth, adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM payment_methods ORDER BY name");
    res.json({ paymentMethods: result.rows });
  } catch (error) {
    next(error);
  }
});
app.patch("/api/admin/payment-methods/:id", auth, adminOnly, async (req, res, next) => {
  try {
    const id = req.params.id;
    const updates = [];
    const values = [];
    const fieldMap = {
      name: "name",
      network: "network",
      depositAddress: "deposit_address",
      qrData: "qr_data",
      instructions: "instructions",
      enabled: "enabled",
      minimumAmount: "minimum_amount",
      maximumAmount: "maximum_amount",
    };
    for (const [inputKey, columnKey] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(req.body, inputKey)) {
        updates.push(`${columnKey} = $${values.length + 1}`);
        values.push(req.body[inputKey]);
      }
    }
    if (!updates.length) return jsonError(res, 400, "No payment method changes were provided.");
    values.push(id);
    const result = await pool.query(
      `UPDATE payment_methods SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rowCount) return jsonError(res, 404, "Payment method not found.");
    res.json({ paymentMethod: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/orders", auth, adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT o.*, p.status AS payment_record_status, p.transaction_id, p.submitted_at, p.verified_at, pp.id AS payment_proof_id, pp.storage_path AS payment_proof, pp.original_name AS payment_proof_name, u.name AS user_name, u.email AS user_email FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN payments p ON p.order_id=o.id LEFT JOIN LATERAL (SELECT * FROM payment_proofs WHERE payment_id=p.id ORDER BY created_at DESC LIMIT 1) pp ON true ORDER BY o.created_at DESC`,
    );
    res.json({ orders: result.rows });
  } catch (error) {
    next(error);
  }
});
app.get("/api/admin/users", auth, adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT u.*,EXISTS(SELECT 1 FROM admin_users a WHERE a.user_id=u.id) AS is_admin FROM users u ORDER BY u.created_at DESC",
    );
    res.json({ users: result.rows.map(publicUser) });
  } catch (error) {
    next(error);
  }
});
app.patch("/api/admin/users/:id", auth, adminOnly, async (req, res, next) => {
  const { name, email, accountStatus, password } = req.body || {};
  const userId = req.params.id;
  const updates = [];
  const values = [];

  try {
    if (typeof name === "string") {
      const nextName = name.trim();
      if (!nextName) return jsonError(res, 400, "Name cannot be empty.");
      updates.push("name = $" + (values.length + 1));
      values.push(nextName);
    }

    if (typeof email === "string") {
      const nextEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail))
        return jsonError(res, 400, "Please enter a valid email address.");
      const existing = await pool.query(
        "SELECT id FROM users WHERE lower(email)=lower($1) AND id <> $2",
        [nextEmail, userId],
      );
      if (existing.rowCount)
        return jsonError(res, 409, "An account with that email already exists.");
      updates.push("email = $" + (values.length + 1));
      values.push(nextEmail);
    }

    if (typeof accountStatus === "string") {
      if (!["active", "pending", "suspended", "locked"].includes(accountStatus))
        return jsonError(res, 400, "Invalid account status.");
      updates.push("account_status = $" + (values.length + 1));
      values.push(accountStatus);
    }

    if (typeof password === "string" && password.length > 0) {
      if (password.length < 8)
        return jsonError(res, 400, "New password must be at least 8 characters long.");
      updates.push("password_hash = $" + (values.length + 1));
      values.push(await bcrypt.hash(password, 12));
    }

    if (updates.length === 0) return jsonError(res, 400, "No account changes were provided.");

    values.push(userId);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rowCount) return jsonError(res, 404, "User not found.");

    if (typeof password === "string" && password.length > 0) {
      await pool.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
    }
    await audit(pool, req.user.id, "update", "user", userId, {
      fields: updates.map((field) => field.split(" ")[0]),
      passwordReset: typeof password === "string" && password.length > 0,
    });
    const adminResult = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id=$1) AS is_admin",
      [userId],
    );
    res.json({
      user: publicUser({
        ...result.rows[0],
        is_admin: adminResult.rows[0].is_admin,
      }),
    });
  } catch (error) {
    if (error.code === "23505")
      return jsonError(res, 409, "An account with that email already exists.");
    next(error);
  }
});
app.get("/api/admin/summary", auth, adminOnly, async (_req, res, next) => {
  try {
    const [orderSummary, userCount, fundedAccounts] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total_orders, COUNT(*) FILTER (WHERE order_status='pending_verification') AS pending_orders, COUNT(*) FILTER (WHERE order_status IN ('approved', 'active')) AS approved_orders, COUNT(*) FILTER (WHERE order_status='rejected') AS rejected_orders, COALESCE(SUM(CASE WHEN payment_status='confirmed' OR order_status IN ('approved', 'active') THEN amount ELSE 0 END), 0)::numeric(12,2) AS total_sales FROM orders`,
      ),
      pool.query("SELECT COUNT(*) AS total_users FROM users"),
      pool.query("SELECT COUNT(*) AS active_funded_accounts FROM funded_accounts"),
    ]);
    const summary = orderSummary.rows[0];
    res.json({
      summary: {
        total_users: Number(userCount.rows[0].total_users ?? 0),
        total_orders: Number(summary.total_orders ?? 0),
        total_sales: Number(summary.total_sales ?? 0),
        pending_orders: Number(summary.pending_orders ?? 0),
        approved_orders: Number(summary.approved_orders ?? 0),
        rejected_orders: Number(summary.rejected_orders ?? 0),
        active_funded_accounts: Number(fundedAccounts.rows[0].active_funded_accounts ?? 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

async function setOrderStatus(req, res, next, requestedStatus) {
  const targetStatus = requestedStatus || req.body?.status;
  if (!["pending_verification", "approved", "rejected"].includes(targetStatus))
    return jsonError(res, 400, "Invalid order status.");
  const accountEmail = String(req.body?.accountEmail || "").trim();
  const accountPassword = String(req.body?.accountPassword || "").trim();
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "SELECT o.*, p.id AS payment_id FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=$1 FOR UPDATE",
      [req.params.id],
    );
    if (!found.rowCount) {
      await client.query("ROLLBACK");
      return jsonError(res, 404, "Order not found.");
    }
    const order = found.rows[0];
    if (targetStatus === "approved") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail))
        return await rollbackError(client, res, 400, "A valid account email is required.");
      if (!accountPassword)
        return await rollbackError(client, res, 400, "An account password is required.");
      const encryptedPassword = encryptSecret(accountPassword);
      await client.query(
        `INSERT INTO funded_accounts (order_id, user_id, broker_id, account_email, account_password_encrypted)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (order_id) DO UPDATE SET user_id=EXCLUDED.user_id, broker_id=EXCLUDED.broker_id, account_email=EXCLUDED.account_email, account_password_encrypted=EXCLUDED.account_password_encrypted, updated_at=now()`,
        [order.id, order.user_id, order.broker_id, accountEmail, encryptedPassword],
      );
      await client.query(
        "UPDATE orders SET payment_status='confirmed',order_status='approved',rejection_reason=NULL,approved_by=$1,approved_at=now(),updated_at=now() WHERE id=$2",
        [req.user.id, req.params.id],
      );
      await client.query(
        "UPDATE payments SET status='confirmed',verified_at=now(),verified_by=$1,rejection_reason=NULL,updated_at=now() WHERE id=$2",
        [req.user.id, order.payment_id],
      );
    } else {
      await client.query("DELETE FROM funded_accounts WHERE order_id=$1", [req.params.id]);
      await client.query(
        "UPDATE orders SET payment_status=$1,order_status=$2,rejection_reason=$3,approved_by=NULL,approved_at=NULL,updated_at=now() WHERE id=$4",
        [
          targetStatus === "rejected" ? "rejected" : "pending",
          targetStatus,
          targetStatus === "rejected" ? reason : null,
          req.params.id,
        ],
      );
      await client.query(
        "UPDATE payments SET status=$1,rejection_reason=$2,verified_at=$3,verified_by=$4,updated_at=now() WHERE id=$5",
        [
          targetStatus === "rejected" ? "rejected" : "pending",
          targetStatus === "rejected" ? reason : null,
          targetStatus === "pending_verification" ? null : new Date(),
          targetStatus === "pending_verification" ? null : req.user.id,
          order.payment_id,
        ],
      );
    }
    await audit(client, req.user.id, "order.status_changed", "order", req.params.id, {
      previousStatus: order.order_status,
      newStatus: targetStatus,
    });
    await client.query("COMMIT");
    return res.json({
      order: {
        id: req.params.id,
        paymentStatus:
          targetStatus === "approved"
            ? "confirmed"
            : targetStatus === "rejected"
              ? "rejected"
              : "pending",
        orderStatus: targetStatus,
        rejectionReason: targetStatus === "rejected" ? reason : null,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
}

async function rollbackError(client, res, status, message) {
  await client.query("ROLLBACK");
  return jsonError(res, status, message);
}

async function rejectOrder(req, res, next) {
  return setOrderStatus(req, res, next, "rejected");
}

async function approveOrder(req, res, next) {
  return setOrderStatus(req, res, next, "approved");
}
app.patch("/api/admin/orders/:id/approve", auth, adminOnly, (req, res, next) =>
  approveOrder(req, res, next),
);
app.patch("/api/admin/orders/:id/verify", auth, adminOnly, (req, res, next) =>
  approveOrder(req, res, next),
);
app.patch("/api/admin/orders/:id/reject", auth, adminOnly, (req, res, next) =>
  rejectOrder(req, res, next),
);
app.patch("/api/admin/orders/:id/status", auth, adminOnly, (req, res, next) =>
  setOrderStatus(req, res, next),
);

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : "Unknown API error.";
  return message
    .replace(/postgres(?:ql):\/\/[^\s'\"]+/gi, "[redacted-database-url]")
    .replace(
      /((?:database_url|session_secret|funded_account_encryption_key|blob_read_write_token|admin_password|password|token|secret|key)\s*[=:]\s*)[^\s,;]+/gi,
      "$1[redacted]",
    );
}

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ error: "Payment proof upload is invalid or exceeds the configured size limit." });
  }
  if (nodeEnvironment === "production") {
    const errorId = crypto.randomUUID();
    console.error("API request failed.", {
      errorId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode: error?.code || "UNKNOWN",
      errorMessage: safeErrorMessage(error),
    });
    return res.status(500).json({ error: "Internal server error." });
  }
  console.error(error instanceof Error ? error.message : "Unknown API error.");
  return res.status(500).json({
    error: error instanceof Error ? error.message : "Internal server error.",
  });
});
export default app;
export { app };
