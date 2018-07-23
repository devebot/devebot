'use strict';

var util = require('util');

var errors = {};

errors.createConstructor = function(errorName) {
  let ErrorConstructor = function() {
    let message = undefined, code = undefined, payload = undefined;
    Array.prototype.forEach.call(arguments, function(arg) {
      if (arg) {
        let type = typeof(arg);
        switch(type) {
          case 'string': {
            if (message !== undefined) {
              throw new TypeError(util.format('%s has already initialized', 'message'));
            }
            message = arg;
            break;
          }
          case 'number': {
            if (code !== undefined) {
              throw new TypeError(util.format('%s has already initialized', 'code'));
            }
            code = arg;
            break;
          }
          case 'object': {
            if (payload !== undefined) {
              throw new TypeError(util.format('%s has already initialized', 'payload'));
            }
            payload = arg;
            break;
          }
          default: {
            throw new TypeError(util.format('invalid type: [%s]/%s', arg, type));
          }
        }
      }
    });
    AbstractError.call(this, message, code, payload);
    this.name = errorName;
  }
  util.inherits(ErrorConstructor, AbstractError);
  return ErrorConstructor;
}

errors.isDerivative = function(ErrorConstructor) {
  return typeof ErrorConstructor === 'function' &&
      ErrorConstructor.prototype instanceof AbstractError;
}

errors.isDescendant = function(error) {
  return error instanceof AbstractError;
}

Object.defineProperty(errors, 'stackTraceLimit', {
  get: function() { return stackTraceLimit },
  set: function(val) {
    if (typeof val === 'number') {
      stackTraceLimit = val;
    }
  }
});

var stackTraceLimit = parseInt(process.env.ERROR_STACK_TRACE_LIMIT) || Error.stackTraceLimit;

var AbstractError = function(message, code, payload) {
  Error.call(this, message);
  this.message = message;
  this.code = code;
  this.payload = payload;
  var oldLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = stackTraceLimit;
  Error.captureStackTrace(this, this.constructor);
  Error.stackTraceLimit = oldLimit;
}
util.inherits(AbstractError, Error);

module.exports = errors;
