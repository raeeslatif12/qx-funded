import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const serverFile = readFileSync("server/index.mjs", "utf8");
const packageFile = readFileSync("package.json", "utf8");
const vercelConfig = JSON.parse(readFileSync(".vercel/output/config.json", "utf8"));
const functionDirectories = readdirSync(".vercel/output/functions", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

test("Nitro emits one Vercel function for the API and one for the frontend", () => {
  assert.deepEqual(functionDirectories.sort(), ["__server.func", "api"].sort());
  assert.equal(
    readdirSync(".vercel/output/functions/api").filter((name) => name.endsWith(".func")).length,
    1,
  );
  assert.ok(existsSync(".vercel/output/functions/api/[...path].func/index.mjs"));
  assert.deepEqual(
    vercelConfig.routes.filter((route) => route.src?.startsWith("/api")),
    [{ src: "/api/?(?<path>.+)", dest: "/api/[...path]" }],
  );
  assert.doesNotMatch(JSON.stringify(vercelConfig), /dest":\s*"\/__server".*api/);
  assert.match(serverFile, /export default app/);
  assert.doesNotMatch(serverFile, /app\.listen\(/);
});

test("production API uses same-origin frontend requests", () => {
  assert.doesNotMatch(packageFile, /backend:start/);
  assert.match(serverFile, /app\.get\("\/api\/health"/);
});

test("emitted Nitro handler serves the API endpoints", async () => {
  const apiHandler = (await import("../.vercel/output/functions/api/[...path].func/index.mjs"))
    .default;
  const request = async (path, options = {}) => {
    const server = createServer(apiHandler);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    try {
      return await fetch(`http://127.0.0.1:${address.port}${path}`, {
        ...options,
        headers: { "x-forwarded-for": "127.0.0.1", ...options.headers },
      });
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  };

  const healthResponse = await request("/api/health");
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { ok: true, service: "qxt-api" });

  const registerResponse = await request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "", email: "safe-test@example.invalid", password: "short" }),
  });
  assert.equal(registerResponse.status, 400);
  assert.match(await registerResponse.text(), /Name, valid email and password/i);

  const loginResponse = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "safe-test@example.invalid", password: "not-a-real-password" }),
  });
  assert.equal(loginResponse.status, 401);

  const meResponse = await request("/api/auth/me");
  assert.equal(meResponse.status, 401);
});
