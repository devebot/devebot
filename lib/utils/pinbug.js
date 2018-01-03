'use strict';

var debug = null;

var pinbug = function(pkgName) {
  if (debug == null) {
    try {
      debug = require('debug');
    } catch(err) {
      debug = function() {
        var log = function() {
          return console.log.apply(console, arguments);
        }
        log.enabled = false;
        return log;
      };
    }
  }
  // @deprecated
  debug.isEnabled = process.env.DEBUG;
  return debug(pkgName);
};

// @deprecated
pinbug.isEnabled = process.env.DEBUG;

module.exports = pinbug;
