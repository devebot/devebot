'use strict';

var logger = require('./logger.js');

var loader = function(name) {
  try {
    return require(name);
  } catch(err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      logger.trace(' - file: ' + name + ' not found.');
    }
    return {};
  }
}

module.exports = loader;