import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const apiFile = readFileSync("api/[...path].mjs", "utf8");
const serverFile = readFileSync("server/index.mjs", "utf8");
const packageFile = readFileSync("package.json", "utf8");

test("Vercel exposes the existing Express API as a catch-all function", () => {
  assert.match(apiFile, /from "\.\.\/server\/index\.mjs"/);
  assert.match(apiFile, /export default app/);
  assert.match(apiFile, /bodyParser: false/);
  assert.match(serverFile, /export default app/);
  assert.doesNotMatch(serverFile, /app\.listen\(/);
});

test("production API uses same-origin frontend requests", () => {
  assert.doesNotMatch(packageFile, /backend:start/);
  assert.match(serverFile, /app\.get\("\/api\/health"/);
});

test("Vercel adapter routes POST /api/auth/register to Express", async () => {
  const apiHandler = (await import("../api/[...path].mjs")).default;
  const server = createServer(apiHandler);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "", email: "safe-test@example.invalid", password: "short" }),
    });

    assert.equal(response.status, 400);
    assert.match(await response.text(), /Name, valid email and password/i);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
