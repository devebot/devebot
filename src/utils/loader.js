'use strict';

const nodash = require('./nodash');

const MAPPINGS = {
  'MODULE_NOT_FOUND': 'Module not found'
}

function _logit(L, level) {
  L = nodash.isObject(L) && nodash.isFunction(L.has) && nodash.isFunction(L.log) && L || null;
  L && L.has(level) && L.log.apply(Array.prototype.slice.call(arguments, 1));
}

let loader = function(name, opts) {
  opts = opts || {};
  let modref = {};
  try {
    modref = require(name);
    _logit(opts.logger, 'debug', ' - file %s is loading ... ok', name);
  } catch(err) {
    if (err.code) {
      if (MAPPINGS[err.code]) {
        _logit(opts.logger, 'debug', ' - file %s is loading ... failed. Reason: %s', name, MAPPINGS[err.code]);
      } else {
        _logit(opts.logger, 'debug', ' - file %s is loading ... failed. Error code: %s', name, err.code);
      }
    } else {
      _logit(opts.logger, 'debug', ' - file %s is loading ... failed. Error message: %s', name, err.message);
    }
    if (opts.stopWhenError) {
      _logit(opts.logger, 'error', ' - loading module file [%s] throw error.', name);
      throw err;
    }
  }
  return modref;
};

module.exports = loader;
