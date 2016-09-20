'use strict';

var debuglog = require('./debug.js')('devebot:loader');

var loader = function(name) {
  try {
    var modref = require(name);
    debuglog.isEnabled && debuglog(' - file %s is loading ... ok', name);
    return modref;
  } catch(err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      debuglog.isEnabled && debuglog(' - file %s is loading ... error. File not found', name);
    } else {
      debuglog.isEnabled && debuglog(' - file %s is loading ... error. Error: %s', name, JSON.stringify(err));
    }
    return {};
  }
};

module.exports = loader;
