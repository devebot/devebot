'use strict';

var lodash = require('lodash');
var debugx = require('../utils/debug.js')('devebot:errorHandler');

function ErrorHandler(params) {
  var self = this;
  params = params || {};

  debugx.enabled && debugx(' + constructor start ...');

  self.exit = function(code, forced) {
    code = lodash.isNumber(code) ? code : 1;
    forced = lodash.isUndefined(forced) ? false : forced;
    debugx.enabled && debugx('exit(%s, %s) is invoked', code, forced);
    if (forced) {
      process.exit(code);
    } else {
      process.exitCode = code;
    }
  }

  debugx.enabled && debugx(' - constructor has finished');
}

ErrorHandler.argumentSchema = {
  "id": "errorHandler",
  "type": "object",
  "properties": {}
};

module.exports = ErrorHandler;

var errorHandler;

Object.defineProperty(ErrorHandler, 'instance', {
  get: function() {
    return (errorHandler = errorHandler || new ErrorHandler());
  },
  set: function(value) {}
});
