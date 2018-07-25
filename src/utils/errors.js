'use strict';

const util = require('util');
const getenv = require('./getenv');

function ErrorCollection() {
  this.createConstructor = function(errorName) {
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

  this.isDerivative = function(ErrorConstructor) {
    return typeof ErrorConstructor === 'function' &&
        ErrorConstructor.prototype instanceof AbstractError;
  }

  this.isDescendant = function(error) {
    return error instanceof AbstractError;
  }

  Object.defineProperty(this, 'stackTraceLimit', {
    get: function() { return stackTraceLimit },
    set: function(val) {
      if (typeof val === 'number') {
        stackTraceLimit = val;
      }
    }
  });

  let stackTraceLimit = parseInt(getenv('DEVEBOT_STACK_TRACE_LIMIT')) || Error.stackTraceLimit;

  function AbstractError(message, code, payload) {
    Error.call(this, message);
    this.message = message;
    this.code = code;
    this.payload = payload;
    let oldLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = stackTraceLimit;
    Error.captureStackTrace(this, this.constructor);
    Error.stackTraceLimit = oldLimit;
  }
  util.inherits(AbstractError, Error);
}

module.exports = new ErrorCollection();
