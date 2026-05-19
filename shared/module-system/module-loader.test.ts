import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, expect, it, jest } from '@jest/globals';

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../utils/logger', () => ({
  createModuleLogger: () => loggerMock,
}));

import { ModuleLoader } from './module-loader';

describe('ModuleLoader', () => {
  it('logs optional missing runtime dependencies as info-level skip', async () => {
    jest.clearAllMocks();

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'module-loader-test-'));
    const optionalModulePath = path.join(tempRoot, 'notifications', 'src');

    fs.mkdirSync(optionalModulePath, { recursive: true });
    fs.writeFileSync(
      path.join(optionalModulePath, 'index.js'),
      "module.exports = require('missing-runtime-dependency');",
    );

    const loader = new ModuleLoader();
    const loaded = await loader.loadModules(tempRoot);

    expect(loaded).toHaveLength(0);
    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.stringContaining('Skipping optional module "notifications"'),
    );
    expect(loggerMock.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to load module "notifications"'),
    );
  });

  it('logs non-module exports as info-level skip', async () => {
    jest.clearAllMocks();

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'module-loader-test-'));
    const nonModulePath = path.join(tempRoot, 'analytics', 'src');

    fs.mkdirSync(nonModulePath, { recursive: true });
    fs.writeFileSync(path.join(nonModulePath, 'index.js'), 'module.exports = { notAModule: true };');

    const loader = new ModuleLoader();
    const loaded = await loader.loadModules(tempRoot);

    expect(loaded).toHaveLength(0);
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Skipping folder "analytics": export is not a runtime ICypherModule',
    );
    expect(loggerMock.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('analytics'),
    );
  });

  it('skips folders without index files instead of warning', async () => {
    jest.clearAllMocks();

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'module-loader-test-'));
    const validModulePath = path.join(tempRoot, 'valid-module', 'src');
    const invalidModulePath = path.join(tempRoot, 'not-a-module', 'src');

    fs.mkdirSync(validModulePath, { recursive: true });
    fs.mkdirSync(invalidModulePath, { recursive: true });

    fs.writeFileSync(
      path.join(validModulePath, 'index.js'),
      [
        'module.exports = class ValidModule {',
        "  constructor() { this.name = 'valid-module'; this.version = '1.0.0'; this.description = 'valid'; this.dependencies = []; this.publishedEvents = []; this.subscribedEvents = []; }",
        '  async initialize() {}',
        '  async start() {}',
        '  async stop() {}',
        "  async getHealth() { return { status: 'healthy', details: {}, lastChecked: new Date() }; }",
        '  getRouter() { return () => undefined; }',
        "  getMetrics() { return { requestCount: 0, errorCount: 0, avgResponseTime: 0, activeWorkers: 0, cacheHitRate: 0, eventCount: { published: 0, received: 0 } }; }",
        '}',
      ].join('\n'),
    );

    const loader = new ModuleLoader();
    const loaded = await loader.loadModules(tempRoot);

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.name).toBe('valid-module');
    expect(loggerMock.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Module index file not found'),
    );
  });
});
