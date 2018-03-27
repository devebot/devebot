'use strict';

var lodash = require('lodash');
var chores = require('../utils/chores');
var LoggingWrapper = require('./logging-wrapper');

function ErrorHandler(params) {
  var self = this;
  params = params || {};

  var blockRef = chores.getBlockRef(__filename);
  var loggingWrapper = new LoggingWrapper(blockRef);
  var LX = loggingWrapper.getLogger();
  var LT = loggingWrapper.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  var opStates = [];

  this.init = function() {
    return this.reset();
  }

  this.collect = function(info) {
    if (info instanceof Array) {
      opStates.push.apply(opStates, info);
    } else {
      if (info && typeof info === 'object') {
        opStates.push(info);
      }
    }
    return this;
  }

  this.examine = function(options) {
    options = options || {};
    var summary = lodash.reduce(opStates, function(store, item) {
      if (item.hasError) {
        store.numberOfErrors += 1;
        store.failedServices.push(item);
      }
      return store;
    }, { numberOfErrors: 0, failedServices: [] });
    LX.has('silly') && LX.log('silly', LT.add({
      invoker: options.invoker,
      totalOfErrors: summary.numberOfErrors,
      errors: summary.failedServices
    }).toMessage({
      tags: [ blockRef, 'examine' ],
      text: ' - Total of errors: ${totalOfErrors}'
    }));
    return summary;
  }

  this.barrier = function(options) {
    options = options || {};
    var silent = chores.isSilentForced('error-handler', options);
    var summary = this.examine(options);
    if (summary.numberOfErrors > 0) {
      if (!silent) {
        console.error('[x] There are %s error(s) occurred during load:', summary.numberOfErrors);
        lodash.forEach(summary.failedServices, function(fsv) {
          if (fsv.stage === 'bootstrap') {
            switch(fsv.type) {
              case 'application':
              case 'plugin':
              case 'devebot':
              console.error('--> [%s:%s] loading plugin is failed, reasons:\n%s', fsv.type, fsv.name, fsv.stack);
              return;
              case 'bridge':
              console.error('--> [%s:%s] loading bridge is failed, reasons:\n%s', fsv.type, fsv.name, fsv.stack);
              return;
            }
          }
          if (fsv.stage === 'naming') {
            switch(fsv.type) {
              case 'plugin':
              console.error('--> [%s:%s] resolving plugin-code is failed, reasons:\n%s', fsv.type, fsv.name, fsv.stack);
              return;
              case 'bridge':
              console.error('--> [%s:%s] resolving bridge-code is failed, reasons:\n%s', fsv.type, fsv.name, fsv.stack);
              return;
            }
          }
          if (fsv.stage === 'config/schema') {
            switch(fsv.type) {
              case 'application':
              case 'plugin':
              case 'devebot':
              console.error('--> [%s:%s] plugin configure is invalid, reasons:\n%s', fsv.type, fsv.name, fsv.stack);
              return;
              case 'bridge':
              console.error('--> [%s:%s] bridge configure is invalid, reasons:\n%s', fsv.type, fsv.name, fsv.stack);
              return;
            }
          }
          if (fsv.stage === 'instantiating') {
            switch(fsv.type) {
              case 'ROUTINE':
              case 'SERVICE':
              case 'TRIGGER':
              console.error('--> [%s:%s] new() is failed:\n   %s', fsv.type, fsv.name, fsv.stack);
              return;
              case 'DIALECT':
              console.error('--> [%s:%s/%s] new() is failed:\n   %s', fsv.type, fsv.code, fsv.name, fsv.stack);
              return;
              default:
              console.error('--> %s', JSON.stringify(fsv));
              return;
            }
          }
          switch(fsv.type) {
            case 'CONFIG':
            console.error('--> [%s] in (%s):\n   %s', fsv.type, fsv.file, fsv.stack);
            break;
            case 'ROUTINE':
            case 'SERVICE':
            case 'TRIGGER':
            console.error('--> [%s:%s] - %s in (%s%s):\n   %s', fsv.type, fsv.name, fsv.file, fsv.pathDir, fsv.subDir, fsv.stack);
            break;
            case 'DIALECT':
            console.error('--> [%s:%s/%s] in (%s):\n   %s', fsv.type, fsv.code, fsv.name, fsv.path, fsv.stack);
            break;
            case 'application':
            console.error('--> [%s:%s/%s] in (%s):\n   %s', fsv.type, fsv.name, fsv.code, fsv.path, fsv.stack);
            break;
            default:
            console.error('--> %s', JSON.stringify(fsv));
          }
        });
      }
      LX.has('silly') && LX.log('silly', LT.add({
        invoker: options.invoker,
        silent: silent,
        exitOnError: (options.exitOnError !== false)
      }).toMessage({
        tags: [ blockRef, 'barrier' ],
        text: ' - Program will be exited? (${exitOnError})'
      }));
      if (options.exitOnError !== false) {
        if (!silent) {
          console.warn('==@ The program will exit now.');
          console.warn('... Please fix the issues and then retry again.');
        }
        this.exit(1);
      }
    }
  }

  this.exit = function(code) {
    code = lodash.isNumber(code) ? code : 0;
    LX.has('silly') && LX.log('silly', LT.add({
      exitCode: code
    }).toMessage({
      tags: [ blockRef, 'exit' ],
      text: 'process.exit(${exitCode}) is invoked'
    }));
    if (!chores.skipProcessExit()) {
      process.exit(code);
    }
  }

  this.reset = function() {
    opStates.splice(0, opStates.length);
    return this;
  }

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

ErrorHandler.argumentSchema = {
  "$id": "errorHandler",
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
