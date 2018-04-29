'use strict';

const debugx = require('./pinbug')('devebot:utils:loader');

const MAPPINGS = {
  'MODULE_NOT_FOUND': 'Module not found'
}

let loader = function(name, opts) {
  opts = opts || {};
  try {
    let modref = require(name);
    debugx.enabled && debugx(' - file %s is loading ... ok', name);
    return modref;
  } catch(err) {
    if (err.code) {
      if (MAPPINGS[err.code]) {
        debugx.enabled && debugx(' - file %s is loading ... failed. Reason: %s', name, MAPPINGS[err.code]);
      } else {
        debugx.enabled && debugx(' - file %s is loading ... failed. ErrorCode: %s', name, err.code);
      }
    } else {
      debugx.enabled && debugx(' - file %s is loading ... failed. Error message: %s', name, err.message);
    }
    if (opts.stopWhenError) {
      debugx.enabled && debugx(' - loading module [%s] throw error.', name);
      throw err;
    }
    return {};
  }
};

module.exports = loader;
