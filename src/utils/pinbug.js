'use strict';

let debug = null;

let pinbug = function(pkgName) {
  if (debug == null) {
    try {
      debug = require('debug');
    } catch(err) {
      debug = function() {
        let log = function() {
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
