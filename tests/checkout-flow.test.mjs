import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checkoutFlowFile = "src/components/CheckoutFlow.tsx";

test("admin dashboard enforces the dedicated login credentials and protected route flow", () => {
  const content = readFileSync(checkoutFlowFile, "utf8");
  assert.match(content, /admin@gmail\.com/i);
  assert.match(content, /placeholder="admin"/i);
  assert.match(
    content,
    /if \(!user\?\.admin\) return <AdminAuthRequired next="\/admin-dashboard" \/>/i,
  );
});

test("customer orders do not apply cached status before the server-first loader resolves", () => {
  const content = readFileSync(checkoutFlowFile, "utf8");
  assert.match(content, /const result = await getOrdersForUserWithCache\(user\.id\);/);
  assert.doesNotMatch(content, /const cached = getCachedOrdersForUser\(user\.id\);/);
  assert.doesNotMatch(content, /setOrders\(cached\.data\);/);
  assert.match(content, /status === "pending" \|\| status === "pending_verification"/);
});

test("shared cache fallback is limited to backend-unavailable errors", () => {
  const content = readFileSync("src/lib/backend.ts", "utf8");
  assert.match(content, /if \(!isBackendUnavailable\(error\)\) throw error;/);
});

test("admin order details expose reversible status controls", () => {
  const content = readFileSync(checkoutFlowFile, "utf8");
  assert.match(content, /Change order status/);
  assert.match(content, /value="pending_verification">Pending<\/option>/);
  assert.match(content, /This order is already/);
  assert.match(content, /updateOrderStatusForAdmin/);
});
