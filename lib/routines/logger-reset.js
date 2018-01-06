'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');

var commandConfig;

var commandObject = {
  info: {
    alias: 'log-reset',
    description: 'Resets logging level to the default levels',
    options: []
  },
  handler: function(options, payload, ctx) {
    var loggingFactory = chores.pickProperty('loggingFactory', [ctx, this, commandConfig], {});
    var originLogger = loggingFactory.getLogger({ type: 'origin' });
    var promixe = Promise.resolve().then(function() {
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
