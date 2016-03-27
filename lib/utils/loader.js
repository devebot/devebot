'use strict';

var debuglog = require('./debug.js')('devebot:loader');

var loader = function(name) {
  try {
    debuglog(' + script file %s is loading...', name);
    return require(name);
  } catch(err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      debuglog(' - error on load file: %s. File not found', name);
    } else {
      debuglog(' - error on load file: %s. Error: %s', name, JSON.stringify(err));
    }
    return {};
  }
};

module.exports = loader;