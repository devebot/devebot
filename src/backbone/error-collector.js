'use strict';

const lodash = require('lodash');
const Chalk = require('../utils/chalk');
const chores = require('../utils/chores');
const LoggingWrapper = require('./logging-wrapper');
const blockRef = chores.getBlockRef(__filename);

function ErrorCollector(params) {
  params = params || {};

  let self = this;
  let loggingWrapper = new LoggingWrapper(blockRef);
  let LX = loggingWrapper.getLogger();
  let LT = loggingWrapper.getTracer();

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  let opStates = [];

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
    let summary = lodash.reduce(opStates, function(store, item) {
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
      tags: [ blockRef, 'examine', options.footmark ],
      text: ' - Total of errors: ${totalOfErrors}'
    }));
    return summary;
  }

  this.barrier = function(options) {
    options = options || {};
    let silent = chores.isSilentForced('error-collector', options);
    let summary = this.examine(options);
    if (summary.numberOfErrors > 0) {
      if (!silent) {
        console.error(chalk.errorHeader('[x] There are %s error(s) occurred during load:'), summary.numberOfErrors);
        lodash.forEach(summary.failedServices, function(fsv) {
          if (fsv.stage === 'bootstrap') {
            switch(fsv.type) {
              case 'application':
              case 'plugin':
              case 'devebot':
              console.error(chalk.errorMessage('--> [%s:%s] loading plugin is failed, reasons:'), fsv.type, fsv.name);
              console.error(chalk.errorStack("  " + fsv.stack));
              return;
              case 'bridge':
              console.error(chalk.errorMessage('--> [%s:%s] loading bridge is failed, reasons:'), fsv.type, fsv.name);
              console.error(chalk.errorStack("  " + fsv.stack));
              return;
            }
          }
          if (fsv.stage === 'naming') {
            switch(fsv.type) {
              case 'plugin':
              console.error(chalk.errorMessage('--> [%s:%s] resolving plugin-code is failed, reasons:'), fsv.type, fsv.name);
              console.error(chalk.errorStack("  " + fsv.stack));
              return;
              case 'bridge':
              console.error(chalk.errorMessage('--> [%s:%s] resolving bridge-code is failed, reasons:'), fsv.type, fsv.name);
              console.error(chalk.errorStack("  " + fsv.stack));
              return;
            }
          }
          if (fsv.stage === 'config/schema') {
            switch(fsv.type) {
              case 'application':
              case 'plugin':
              case 'devebot':
              console.error(chalk.errorMessage('--> [%s:%s] plugin configure is invalid, reasons:'), fsv.type, fsv.name);
              console.error(chalk.errorStack("  " + fsv.stack));
              return;
              case 'bridge':
              console.error(chalk.errorMessage('--> [%s:%s] bridge configure is invalid, reasons:'), fsv.type, fsv.name);
              console.error(chalk.errorStack("  " + fsv.stack));
              return;
            }
          }
          if (fsv.stage === 'instantiating') {
            switch(fsv.type) {
              case 'ROUTINE':
              case 'SERVICE':
              case 'TRIGGER':
              console.error(chalk.errorMessage('--> [%s:%s] new() is failed:'), fsv.type, fsv.name);
              console.error(chalk.errorStack("  " + fsv.stack));
              return;
              case 'DIALECT':
              console.error(chalk.errorMessage('--> [%s:%s/%s] new() is failed:'), fsv.type, fsv.code, fsv.name);
              console.error(chalk.errorStack("  " + fsv.stack));
              return;
              default:
              console.error(chalk.errorMessage('--> %s'), JSON.stringify(fsv));
              return;
            }
          }
          if (fsv.stage === 'check-methods') {
            switch(fsv.type) {
              case 'TRIGGER':
              console.error(chalk.errorMessage('--> [%s:%s] required method(s): %s not found'), fsv.type, fsv.name, JSON.stringify(fsv.methods));
              return;
              default:
              console.error(chalk.errorMessage('--> %s'), JSON.stringify(fsv));
              return;
            }
          }
          switch(fsv.type) {
            case 'CONFIG':
            console.error(chalk.errorMessage('--> [%s] in (%s):'), fsv.type, fsv.file);
            console.error(chalk.errorStack("  " + fsv.stack));
            break;
            case 'ROUTINE':
            case 'SERVICE':
            case 'TRIGGER':
            console.error(chalk.errorMessage('--> [%s:%s] - %s in (%s%s):'), fsv.type, fsv.name, fsv.file, fsv.pathDir, fsv.subDir);
            console.error(chalk.errorStack("  " + fsv.stack));
            break;
            case 'DIALECT':
            console.error(chalk.errorMessage('--> [%s:%s/%s] in (%s):'), fsv.type, fsv.code, fsv.name, fsv.path);
            console.error(chalk.errorStack("  " + fsv.stack));
            break;
            case 'application':
            console.error(chalk.errorMessage('--> [%s:%s/%s] in (%s):'), fsv.type, fsv.name, fsv.code, fsv.path);
            console.error(chalk.errorStack("  " + fsv.stack));
            break;
            default:
            console.error(chalk.errorMessage('--> %s'), JSON.stringify(fsv));
          }
        });
      }
      LX.has('silly') && LX.log('silly', LT.add({
        invoker: options.invoker,
        silent: silent,
        exitOnError: (options.exitOnError !== false)
      }).toMessage({
        tags: [ blockRef, 'barrier', options.footmark ],
        text: ' - Program will be exited? (${exitOnError})'
      }));
      if (options.exitOnError !== false) {
        if (!silent) {
          console.warn(chalk.warnHeader('[!] The program will exit now.'));
          console.warn(chalk.warnMessage('... Please fix the issues and then retry again.'));
        }
        this.exit(1);
      }
    }
  }

  this.exit = function(exitCode) {
    exitCode = lodash.isNumber(exitCode) ? exitCode : 0;
    LX.has('silly') && LX.log('silly', LT.add({ exitCode }).toMessage({
      tags: [ blockRef, 'exit' ],
      text: 'process.exit(${exitCode}) is invoked'
    }));
    switch(chores.fatalErrorReaction()) {
      case 'exit':
        process.exit(exitCode);
        break;
      case 'exception':
        throw new Error('Fatal error, throw exception with code: ' + exitCode);
        break;
    }
    if (!chores.skipProcessExit()) {
      process.exit(exitCode);
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

ErrorCollector.argumentSchema = {
  "$id": "errorHandler",
  "type": "object",
  "properties": {}
};

module.exports = ErrorCollector;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ color chalks

let chalk = new Chalk({
  themes: {
    errorHeader: ['red', 'bold'],
    errorMessage: ['red'],
    errorStack: ['grey'],
    warnHeader: ['yellow', 'bold'],
    warnMessage: ['yellow']
  }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ default instance

let globalErrorCollector;

Object.defineProperty(ErrorCollector, 'instance', {
  get: function() {
    return (globalErrorCollector = globalErrorCollector || new ErrorCollector());
  },
  set: function(value) {}
});
