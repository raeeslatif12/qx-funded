# QXT Funded Deployment

## Architecture

- Frontend and API: Vercel.
- API routes: the existing Express application exposed through Nitro's generated `api/[...path].func` Vercel function.
- Database: Neon PostgreSQL through the existing `pg` client and `DATABASE_URL`.
- Payment proofs: private Vercel Blob objects through `BLOB_READ_WRITE_TOKEN`.
- Local development: Vite proxies `/api` to the optional local Express launcher.

There is no separate production backend service. `server/index.mjs` contains the API and is imported by the Nitro route adapter at `server/routes/api/[...path].mjs`. `server/local.mjs` exists only for local development.

## Environment variables

Add these variables to the Vercel project for Production, Preview, and Development as appropriate:

```text
DATABASE_URL
SESSION_SECRET
FUNDED_ACCOUNT_ENCRYPTION_KEY
ADMIN_EMAIL
ADMIN_PASSWORD
BLOB_READ_WRITE_TOKEN
NODE_ENV=production
PG_POOL_MAX=5
MAX_UPLOAD_BYTES=4194304
```

`DATABASE_URL`, `SESSION_SECRET`, `FUNDED_ACCOUNT_ENCRYPTION_KEY`, `ADMIN_PASSWORD`, and `BLOB_READ_WRITE_TOKEN` are server-only. Do not prefix them with `VITE_`.

The frontend does not require a separately configured API URL. It always calls same-origin `/api/...` paths.

Optional development-only variables:

```text
PORT=3000
UPLOAD_DIR=./uploads
```

`UPLOAD_DIR` is not used for production uploads. Production requires `BLOB_READ_WRITE_TOKEN`.

## Neon setup

1. Create a project at `https://console.neon.tech`.
2. Create or select the production database.
3. Copy the pooled Neon PostgreSQL connection string, normally the hostname containing `-pooler`.
4. Add it as `DATABASE_URL` in the Vercel project environment variables.
5. Run database initialization from a trusted local shell with the same server environment variables loaded:

```sh
npm ci
npm run db:setup
```

The schema enables `pgcrypto`, creates missing tables and indexes, applies additive order changes, and inserts missing seed catalog records. Existing production records are preserved. Existing admin passwords are not overwritten unless `RESET_ADMIN_PASSWORD=true` is explicitly set for a one-time setup command.

The Neon connection string should include `sslmode=require`. A pooled connection is recommended for Vercel serverless execution. `PG_POOL_MAX=5` limits connections per warm function instance; adjust only after observing Neon usage.

## Vercel Blob setup

1. In the Vercel dashboard, open the project and choose **Storage**.
2. Create or attach a Vercel Blob store.
3. Add the store's read/write token as `BLOB_READ_WRITE_TOKEN` in the Vercel project environment variables.

The backend uploads payment proofs as private Blob objects. PostgreSQL stores the object URL. Customers and admins retrieve proofs through an authenticated API route; the Blob URL is not exposed as a public browser link.

## Vercel deployment

1. Import the repository into Vercel.
2. Keep the detected TanStack/Vite framework settings.
3. Use this build command:

```sh
npm run build
```

4. Add the server environment variables listed above.
5. Deploy.

The Vercel build uses the `vercel` Nitro preset from `vite.config.ts`. Nitro emits one `api/[...path].func` function for `/api/*`, handled by `server/routes/api/[...path].mjs`, plus the separate `__server.func` frontend function. No `app.listen()` call runs on Vercel.

## API routing

The Vercel catch-all function preserves the existing Express routes:

- `/api/auth/*`
- `/api/plans`
- `/api/brokers`
- `/api/payment-methods`
- `/api/orders/*`
- `/api/admin/*`

The `/health` route remains available through the imported API app for local use, and `/api/health` is available through the Vercel function.

## Authentication and cookies

Authentication remains server-side in PostgreSQL. The `qxt_session` cookie is HTTP-only, secure in production, SameSite Lax, path `/`, and expires after seven days.

Because the frontend and API share the Vercel origin, no cross-origin cookie configuration is required. The Express CORS middleware is retained for local development but is skipped in the Vercel same-origin runtime.

## Local development

1. Start PostgreSQL locally or point `DATABASE_URL` at Neon.
2. Start the optional local API:

```sh
npm run backend:dev
```

3. Start Vite in another shell:

```sh
npm run dev
```

Vite proxies `/api` and `/health` to `http://localhost:3000`. The browser still uses same-origin paths. Without `BLOB_READ_WRITE_TOKEN`, local development can use `UPLOAD_DIR`.

## Admin initialization

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before running:

```sh
npm run db:setup
```

If the email does not exist, the migration creates the user and adds it to `admin_users`. If it already exists, its password is preserved and the admin membership is ensured.

To intentionally reset that password once:

```powershell
$env:RESET_ADMIN_PASSWORD="true"
npm run db:setup
Remove-Item Env:RESET_ADMIN_PASSWORD
```

Do not leave `RESET_ADMIN_PASSWORD` enabled in Vercel.

## Verification

After deployment, test:

1. Registration, login, refresh, logout, and login again.
2. Account settings and password changes.
3. Plans, brokers, and payment methods.
4. Complete checkout and create an order.
5. Upload a payment proof and reload the dashboard.
6. Confirm proof access requires the authenticated owner or admin.
7. Admin login, order listing, approval, and rejection.
8. Funded-account credential retrieval.
9. Admin catalog management and summary statistics.
10. Direct reloads of customer, checkout, and admin routes.
11. Neon rows for users, sessions, orders, payments, proofs, funded accounts, and audit logs.
12. Vercel Blob persistence after a new deployment.

## Commands

Frontend/Vercel build:

```sh
npm run build
```

Database setup:

```sh
npm run db:setup
```

Local API only:

```sh
npm run backend:dev
```
