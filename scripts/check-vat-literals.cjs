#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIRS = ['frontend/src', 'modules', 'shared'];
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.hbs']);

const VAT_19_RATE_RE = /(?:\b(?:vat|tva|tax(?:_rate|Rate)?)\b[^\n]{0,40}\b0\.19\b|\b0\.19\b[^\n]{0,40}\b(?:vat|tva|tax(?:_rate|Rate)?)\b)/i;
const VAT_19_PERCENT_RE = /(?:\b(?:vat|tva)\b[^\n]{0,30}\b19\s?%\b|\b19\s?%\b[^\n]{0,30}\b(?:vat|tva)\b)/i;

function shouldScan(filePath) {
  const ext = path.extname(filePath);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return false;
  }

  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/node_modules/') || normalized.includes('/dist/')) {
    return false;
  }

  if (normalized.endsWith('.d.ts')) {
    return false;
  }

  if (normalized.includes('/tests/') || normalized.includes('/__tests__/')) {
    return false;
  }

  return true;
}

function walk(dirPath, outFiles) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, outFiles);
      continue;
    }

    if (shouldScan(fullPath)) {
      outFiles.push(fullPath);
    }
  }
}

function checkFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const violations = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (VAT_19_RATE_RE.test(line) || VAT_19_PERCENT_RE.test(line)) {
      violations.push({
        line: i + 1,
        content: line.trim(),
      });
    }
  }

  return violations;
}

const files = [];
for (const relativeDir of TARGET_DIRS) {
  walk(path.join(ROOT, relativeDir), files);
}

const allViolations = [];
for (const file of files) {
  const violations = checkFile(file);
  for (const violation of violations) {
    allViolations.push({
      file: path.relative(ROOT, file).replace(/\\/g, '/'),
      line: violation.line,
      content: violation.content,
    });
  }
}

if (allViolations.length > 0) {
  console.error('[ERROR] VAT guard failed. Found legacy 19% VAT literals in source files:');
  for (const violation of allViolations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.content}`);
  }
  process.exit(1);
}

console.log('[OK] VAT literal guard passed (no 19% VAT source literals found).');
