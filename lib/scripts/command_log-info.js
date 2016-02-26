'use strict';

var Promise = require('bluebird');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Display the logger information',
    options: []
  },
  handler: function(params, ctx) {
    params = params || {};
    ctx = ctx || {};

    var self = this;
    var loggingFactory = ctx.loggingFactory || self.loggingFactory || commandConfig.loggingFactory;
    var sandboxManager = ctx.sandboxManager || self.sandboxManager || commandConfig.sandboxManager;

    return Promise.resolve([loggingFactory.getServiceHelp()]);
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
