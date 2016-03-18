'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Display the sandbox information (how many sandboxes, current sandbox name)',
    options: []
  },
  handler: function(params, ctx) {
    params = params || {};
    ctx = ctx || {};

    var self = this;
    var loggingFactory = ctx.loggingFactory || self.loggingFactory || commandConfig.loggingFactory;
    var sandboxManager = ctx.sandboxManager || self.sandboxManager || commandConfig.sandboxManager;

    return Promise.resolve(sandboxManager.getServiceHelp());
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
