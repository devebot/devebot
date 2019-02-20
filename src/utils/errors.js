'use strict';

const util = require('util');
const getenv = require('./getenv');

function ErrorCollection() {
  const cachedErrors = {};

  this.assertConstructor = function(errorName) {
    cachedErrors[errorName] = cachedErrors[errorName] || this.createConstructor(errorName);
    return cachedErrors[errorName];
  }

  this.createConstructor = function(errorName) {
    function ErrorConstructor() {
      const info = { message: undefined, code: undefined, payload: undefined }
      Array.prototype.forEach.call(arguments, function(arg) {
        if (arg) {
          const type = typeof(arg);
          switch(type) {
            case 'string': {
              if (info.message !== undefined) {
                throw new TypeError(util.format('%s has already initialized', 'message'));
              }
              info.message = arg;
              break;
            }
            case 'number': {
              if (info.code !== undefined) {
                throw new TypeError(util.format('%s has already initialized', 'code'));
              }
              info.code = arg;
              break;
            }
            case 'object': {
              if (info.payload !== undefined) {
                throw new TypeError(util.format('%s has already initialized', 'payload'));
              }
              info.payload = arg;
              break;
            }
            default: {
              throw new TypeError(util.format('invalid type: [%s]/%s', arg, type));
            }
          }
        }
      });
      AbstractError.call(this, info.message, info.code, info.payload);
      this.name = errorName;
    }
    util.inherits(ErrorConstructor, AbstractError);
    return ErrorConstructor;
  }

  this.isDerivative = function(ErrorConstructor) {
    return typeof ErrorConstructor === 'function' &&
        ErrorConstructor.prototype instanceof AbstractError;
  }

  this.isDescendant = function(error) {
    return error instanceof AbstractError;
  }

  Object.defineProperty(this, 'stackTraceLimit', {
    get: function() { return _ref_.stackTraceLimit },
    set: function(val) {
      if (typeof val === 'number') {
        _ref_.stackTraceLimit = val;
      }
    }
  });

  const _ref_ = {
    stackTraceLimit: parseInt(getenv('DEVEBOT_STACK_TRACE_LIMIT')) || Error.stackTraceLimit
  }

  function AbstractError(message, code, payload) {
    Error.call(this, message);
    this.message = message;
    this.code = code;
    this.payload = payload;
    const oldLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = _ref_.stackTraceLimit;
    Error.captureStackTrace(this, this.constructor);
    Error.stackTraceLimit = oldLimit;
  }
  util.inherits(AbstractError, Error);
}

module.exports = new ErrorCollection();
