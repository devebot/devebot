'use strict';

var debug = function(pkgName) {
  var log = (process.env.DEBUG) ? require('debug')(pkgName) : function() {};
  log.isEnabled = process.env.DEBUG;
  return log;
};

debug.isEnabled = process.env.DEBUG;

module.exports = debug;