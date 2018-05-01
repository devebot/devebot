'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');

let commandConfig;

let commandObject = {
  info: {
    alias: 'log-reset',
    description: 'Resets logging level to the default levels',
    options: []
  },
  handler: function(options, payload, ctx) {
    let loggingFactory = chores.pickProperty('loggingFactory', [ctx, this, commandConfig], {});
    let originLogger = loggingFactory.getLogger({ type: 'origin' });
    let promixe = Promise.resolve().then(function() {
      originLogger.resetDefaultLevels();
      return {status: 'ok'};
    });
    return promixe;
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
