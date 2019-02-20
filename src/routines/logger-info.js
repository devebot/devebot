'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');

const commandConfig = {};

const commandObject = {
  info: {
    alias: 'log-info',
    description: 'Display the logger information',
    options: []
  },
  handler: function(options, payload, ctx) {
    const loggingFactory = chores.pickProperty('loggingFactory', [ctx, this, commandConfig], {});
    return Promise.resolve(loggingFactory.getServiceHelp());
  }
};

module.exports = function(params) {
  lodash.merge(commandConfig, params);
  return commandObject;
};
