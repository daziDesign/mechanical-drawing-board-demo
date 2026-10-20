import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const demoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(demoRoot, 'offline', '机械制图教学画板.html');

test('USB page is one self-contained HTML file', () => {
  assert.ok(existsSync(output));
  const html = readFileSync(output, 'utf8');
  assert.ok(statSync(output).size > 100_000);
  assert.match(html, /<meta name="offline-build" content="single-file"/);
  assert.match(html, /<script type="module">/);
  assert.match(html, /<style>/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<link[^>]+(?:stylesheet|modulepreload)/);
  assert.doesNotMatch(html, /(?:src|href)="[^\"]*\/assets\//);
});
