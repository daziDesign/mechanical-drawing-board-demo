import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const demoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientRoot = path.join(demoRoot, "dist", "client");
const base = process.env.GITHUB_PAGES_BASE || "/";

test("GitHub Pages build uses its repository path and includes referenced assets", () => {
  assert.match(base, /^\/(?:[\w.-]+\/)?$/);
  const html = readFileSync(path.join(clientRoot, "index.html"), "utf8");
  assert.doesNotMatch(html, /src\/main\.jsx/);

  const assets = [...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^\"]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(assets.length > 0, "the built page should reference bundled assets");

  for (const asset of assets) {
    assert.ok(asset.startsWith(base), `${asset} must start with ${base}`);
    assert.ok(
      existsSync(path.join(clientRoot, asset.slice(base.length))),
      `${asset} must exist in dist/client`,
    );
  }
});
