'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');

const commandConfig = {};

const commandObject = {
  info: {
    alias: 'log-reset',
    description: 'Resets logging level to the default levels',
    options: []
  },
  handler: function(options, payload, ctx) {
    const loggingFactory = chores.pickProperty('loggingFactory', [ctx, this, commandConfig], {});
    const originLogger = loggingFactory.getLogger({ type: 'origin' });
    const promixe = Promise.resolve().then(function() {
      originLogger.resetDefaultLevels();
      return { status: 'ok' };
    });
    return promixe;
  }
};

module.exports = function(params) {
  lodash.merge(commandConfig, params);
  return commandObject;
};
