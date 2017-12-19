'use strict';

var lodash = require('lodash');
var debugx = require('../utils/debug.js')('devebot:errorHandler');

function ErrorHandler(params) {
  var self = this;
  params = params || {};

  debugx.enabled && debugx(' + constructor start ...');

  var opStates = [];

  this.init = function() {
    opStates.splice(0, opStates.length);
  }

  this.collect = function(info) {
    opStates.push(info);
  }

  this.examine = function() {
    var summary = lodash.reduce(opStates, function(store, item) {
      if (item.hasError) {
        store.numberOfErrors += 1;
        store.failedServices.push(item);
      }
      return store;
    }, { numberOfErrors: 0, failedServices: [] });

    return summary;
  }

  this.barrier = function(options) {
    var summary = this.examine();
    if (summary.numberOfErrors > 0) {
      debugx.enabled && debugx(' - %s constructor(s) has been load failed', summary.numberOfErrors);
      if (options && (options.verbose !== false || options.exitOnError !== false) || debugx.enabled) {
        console.log('[x] Failed to load %s constructor(s):', summary.numberOfErrors);
        lodash.forEach(summary.failedServices, function(fsv) {
          if (fsv.stage == 'instantiating') {
            switch(fsv.type) {
              case 'COMMAND':
              case 'RUNHOOK':
              case 'SERVICE':
              case 'TRIGGER':
              console.log(' -  [%s:%s] new() is failed:\n   %s', fsv.type, fsv.name, fsv.stack);
              break;
              case 'WRAPPER':
              console.log(' -  [%s:%s/%s] new() is failed:\n   %s', fsv.type, fsv.code, fsv.name, fsv.stack);
              break;
              default:
              console.log(' -  %s', JSON.stringify(fsv));
            }
            return;
          }
          switch(fsv.type) {
            case 'COMMAND':
            case 'RUNHOOK':
            case 'SERVICE':
            case 'TRIGGER':
            console.log(' -  [%s:%s] - %s in (%s%s):\n   %s', fsv.type, fsv.name, fsv.file, fsv.pathDir, fsv.subDir, fsv.stack);
            break;
            case 'WRAPPER':
            console.log(' -  [%s:%s/%s] in (%s):\n   %s', fsv.type, fsv.code, fsv.name, fsv.path, fsv.stack);
            break;
            case 'application':
            console.log(' -  [%s:%s/%s] in (%s):\n   %s', fsv.type, fsv.name, fsv.code, fsv.path, fsv.stack);
            break;
            default:
            console.log(' -  %s', JSON.stringify(fsv));
          }
        });
      }
      if (options.exitOnError !== false) {
        console.log('[x] The program will exit now.');
        console.log('[x] Please fix the issues and then retry again.');
        this.exit(1, true);
      }
    }
  }

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
