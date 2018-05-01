'use strict';

const Promise = require('bluebird');
const chores = require('../utils/chores');

let commandConfig;

let commandObject = {
  info: {
    alias: 'log-info',
    description: 'Display the logger information',
    options: []
  },
  handler: function(options, payload, ctx) {
    let loggingFactory = chores.pickProperty('loggingFactory', [ctx, this, commandConfig], {});
    return Promise.resolve(loggingFactory.getServiceHelp());
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
