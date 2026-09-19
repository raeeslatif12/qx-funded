import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const adminRouteFile = "src/routes/admin-dashboard.tsx";
const adminLoginFile = "src/routes/admin-dashboard/login.tsx";
const migrateFile = "server/migrate.mjs";

test("admin route files exist for dedicated admin dashboard and login page", () => {
  assert.equal(existsSync(adminRouteFile), true, "Missing /admin-dashboard route component");
  assert.equal(existsSync(adminLoginFile), true, "Missing /admin-dashboard/login route component");
});

test("backend migration seeds the required admin account credentials", () => {
  const content = readFileSync(migrateFile, "utf8");
  assert.match(content, /admin@gmail\.com/i);
  assert.match(content, /admin/i);
});
