#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');

function getChangedFiles(base, head) {
  try {
    const output = execSync(`git diff --name-only ${base}...${head}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  const base = process.env.BASE_SHA || process.env.GITHUB_BASE_SHA;
  const head = process.env.HEAD_SHA || process.env.GITHUB_SHA;

  if (!base || !head) {
    console.log('No BASE_SHA/HEAD_SHA provided. Running full test suite.');
    const full = spawnSync('npm', ['test'], { stdio: 'inherit' });
    process.exit(full.status || 1);
  }

  const changedFiles = getChangedFiles(base, head);
  if (changedFiles.length === 0) {
    console.log('No changed files detected. Skipping tests.');
    process.exit(0);
  }

  const modulePaths = new Set();
  let runFull = false;

  for (const file of changedFiles) {
    const moduleMatch = file.match(/^modules\/([^/]+)\//);
    if (moduleMatch) {
      modulePaths.add(`modules/${moduleMatch[1]}/tests`);
      continue;
    }

    if (file.startsWith('tests/integration/')) {
      modulePaths.add('tests/integration');
      continue;
    }

    if (
      file.startsWith('src/') ||
      file.startsWith('shared/') ||
      file.startsWith('database/') ||
      file.startsWith('jest') ||
      file === 'package.json' ||
      file === 'package-lock.json' ||
      file === 'tsconfig.json'
    ) {
      runFull = true;
      break;
    }
  }

  if (runFull || modulePaths.size === 0) {
    console.log('Running full test suite due to shared/core changes.');
    const full = spawnSync('npm', ['test', '--', '--runInBand'], { stdio: 'inherit' });
    process.exit(full.status || 1);
  }

  const targets = Array.from(modulePaths);
  console.log(`Running tests for changed targets: ${targets.join(', ')}`);

  const result = spawnSync('npx', ['jest', '--runInBand', '--passWithNoTests', ...targets], {
    stdio: 'inherit',
  });
  process.exit(result.status || 1);
}

main();
