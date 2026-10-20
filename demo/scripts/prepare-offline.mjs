#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const demoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = path.join(demoRoot, 'dist', 'offline-build');
const htmlPath = path.join(buildRoot, 'index.html');
const output = path.join(demoRoot, 'offline', '机械制图教学画板.html');
let html = readFileSync(htmlPath, 'utf8');

function asset(relativeUrl) {
  if (!/^\.\/assets\/[\w.-]+$/.test(relativeUrl)) throw new Error('Unexpected offline asset: ' + relativeUrl);
  return readFileSync(path.join(buildRoot, relativeUrl), 'utf8');
}

let scripts = 0;
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_tag, url) => {
  scripts++;
  return `<script type="module">${asset(url).replace(/<\/script/gi, '<\\/script')}</script>`;
});
let styles = 0;
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_tag, url) => {
  styles++;
  return `<style>${asset(url).replace(/<\/style/gi, '<\\/style')}</style>`;
});
if (scripts !== 1 || styles !== 1 || /(?:src|href)="[^\"]*\/assets\//.test(html)) {
  throw new Error('Offline HTML must inline exactly one script and stylesheet with no asset references.');
}
html = html.replace('</head>', '    <meta name="offline-build" content="single-file" />\n  </head>');
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, html, 'utf8');
console.log('Prepared offline single-file demo: ' + output);
