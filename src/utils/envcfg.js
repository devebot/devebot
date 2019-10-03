'use strict';

const lodash = require('lodash');

function sanitizePrefix (prefix) {
  return lodash.trim(prefix, '_') + '_';
}

function extractEnv (prefix, cfg = {}) {
  cfg.store = cfg.store || {};
  cfg.paths = cfg.paths || [];
  prefix = sanitizePrefix(prefix);
  for (const envName in process.env) {
    if (lodash.startsWith(envName, prefix)) {
      const realName = lodash.replace(envName, prefix, '');
      const fieldPath = lodash.split(realName, '_');
      if (fieldPath.length > 0) {
        lodash.set(cfg.store, fieldPath, process.env[envName]);
        cfg.paths.push(fieldPath);
      }
    }
  }
  return cfg;
}

module.exports = { extractEnv };
