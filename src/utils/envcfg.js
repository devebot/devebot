'use strict';

const lodash = require('lodash');

function sanitizePrefix (prefix) {
  return lodash.trim(prefix, '_') + '_';
}

function extractEnv (prefix, cfg = {}) {
  prefix = sanitizePrefix(prefix);
  for (const envName in process.env) {
    if (lodash.startsWith(envName, prefix)) {
      const realName = lodash.replace(envName, prefix, '');
      const fieldPath = lodash.split(realName, '_');
      lodash.set(cfg, fieldPath, process.env[envName]);
    }
  }
  return cfg;
}

module.exports = { extractEnv };
