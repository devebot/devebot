'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');

var commandConfig;

var commandObject = {
  info: {
    alias: 'sb-info',
    description: 'Display the sandbox information (how many sandboxes, current sandbox name)',
    options: []
  },
  handler: function(options, payload, ctx) {
    var sandboxManager = chores.pickProperty('sandboxManager', [ctx, this, commandConfig], {});
    return Promise.resolve(sandboxManager.getServiceHelp());
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
