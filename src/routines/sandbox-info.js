'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');

const commandConfig = {};

const commandObject = {
  info: {
    alias: 'sb-info',
    description: 'Display the sandbox information (how many sandboxes, current sandbox name)',
    options: []
  },
  handler: function(options, payload, ctx) {
    const sandboxManager = chores.pickProperty('sandboxManager', [ctx, this, commandConfig], {});
    return Promise.resolve(sandboxManager.getServiceHelp());
  }
};

module.exports = function(params) {
  lodash.merge(commandConfig, params);
  return commandObject;
};
