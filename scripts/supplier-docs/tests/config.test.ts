import assert from 'node:assert/strict';
import path from 'node:path';

import { buildConfig } from '../config';

const cfg = buildConfig({ suppliers: 'azzardo,aca', mode: 'dry-run' });

assert.equal(cfg.suppliers.length, 2);
assert.deepEqual(cfg.suppliers, ['azzardo', 'aca']);
assert.equal(cfg.mode, 'dry-run');
assert.equal(cfg.translationMode, 'auto');
assert.equal(cfg.storageRootDir, path.join('uploads', 'supplier-docs'));

const defaultCfg = buildConfig({ suppliers: 'azzardo' });
assert.equal(defaultCfg.mode, 'live');
