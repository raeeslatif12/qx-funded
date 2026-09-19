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
