#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

npm --prefix "$FRONTEND_DIR" run build >/tmp/cypher-erp-frontend-build.log

node <<'NODE'
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const frontendDir = '/opt/cypher-erp/frontend';
const distDir = path.join(frontendDir, 'dist');
const assetsDir = path.join(distDir, 'assets');
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

const LOGIN_SHELL_BUDGET_BYTES = 125 * 1024;
const B2B_SHELL_BUDGET_BYTES = 145 * 1024;

const hrefMatches = [...indexHtml.matchAll(/<(?:script|link)[^>]+href?=\"([^\"]+)\"|<script[^>]+src=\"([^\"]+)\"/g)]
  .map((match) => match[1] || match[2])
  .filter(Boolean)
  .filter((href) => href.startsWith('/assets/') && href.endsWith('.js'));

const entryAssets = [...new Set(hrefMatches)];

const requireAsset = (pattern) => {
  const entries = fs.readdirSync(assetsDir);
  const match = entries.find((entry) => pattern.test(entry));
  if (!match) {
    throw new Error(`Missing asset for ${pattern}`);
  }

  return `/assets/${match}`;
};

const gzipBytes = (assetHref) => {
  const assetPath = path.join(distDir, assetHref.replace(/^\//, ''));
  return zlib.gzipSync(fs.readFileSync(assetPath)).length;
};

const loginChunk = requireAsset(/^LoginPage-.*\.js$/);
const b2bLayoutChunk = requireAsset(/^B2BStoreLayout-.*\.js$/);
const b2bLandingChunk = requireAsset(/^B2BStoreLandingPage-.*\.js$/);

const sumBytes = (assets) => assets.reduce((total, asset) => total + gzipBytes(asset), 0);
const loginShellBytes = sumBytes([...entryAssets, loginChunk]);
const b2bShellBytes = sumBytes([...entryAssets, b2bLayoutChunk, b2bLandingChunk]);

const mainScriptHref = entryAssets.find((asset) => /\/assets\/index-.*\.js$/.test(asset));
if (!mainScriptHref) {
  throw new Error('Missing entry index bundle');
}

const mainScript = fs.readFileSync(path.join(distDir, mainScriptHref.replace(/^\//, '')), 'utf8');

const failures = [];

if (/vendor-charts-.*\.js/.test(indexHtml)) {
  failures.push('chart vendor chunk is modulepreloaded from index.html');
}

if (/from"\.\/vendor-charts-/.test(mainScript)) {
  failures.push('chart vendor chunk is statically imported by the entry bundle');
}

if (loginShellBytes > LOGIN_SHELL_BUDGET_BYTES) {
  failures.push(
    `ERP login shell gzip ${loginShellBytes}B exceeds ${LOGIN_SHELL_BUDGET_BYTES}B budget`,
  );
}

if (b2bShellBytes > B2B_SHELL_BUDGET_BYTES) {
  failures.push(
    `B2B storefront shell gzip ${b2bShellBytes}B exceeds ${B2B_SHELL_BUDGET_BYTES}B budget`,
  );
}

if (failures.length > 0) {
  console.error('Bundle budget check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Bundle budget check passed.');
console.log(`- ERP login shell gzip: ${loginShellBytes}B / ${LOGIN_SHELL_BUDGET_BYTES}B`);
console.log(`- B2B storefront shell gzip: ${b2bShellBytes}B / ${B2B_SHELL_BUDGET_BYTES}B`);
NODE
