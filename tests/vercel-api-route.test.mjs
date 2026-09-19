import test from "node:test";
import assert from "node:assert/strict";
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
