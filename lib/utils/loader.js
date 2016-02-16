'use strict';

var logger = require('logdapter').defaultLogger;

var loader = function(name) {
  try {
  	logger.trace('<scripts> - %s is loading...', name);
    return require(name);
  } catch(err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      logger.trace(' - file: ' + name + ' not found');
    }
    return {};
  }
}

module.exports = loader;