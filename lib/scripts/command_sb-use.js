'use strict';

var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Set the current sandbox to work',
    options: [
      {
        abbr: 'n',
        name: 'name',
        description: 'Name of the new current sandbox',
        required: true
      }
    ]
  },
  handler: function(params, ctx) {
    params = params || {};
    ctx = ctx || {};

    var self = this;
    var loggingFactory = ctx.loggingFactory || self.loggingFactory || commandConfig.loggingFactory;
    var sandboxManager = ctx.sandboxManager || self.sandboxManager || commandConfig.sandboxManager;

    var promixe;
    var sandboxName = params['name'];
    if (sandboxManager.isSandboxAvailable(sandboxName)) {
      sandboxManager.setSandboxPointer(sandboxName);
      promixe = Promise.resolve({ currentSandbox: sandboxName });
    } else {
      promixe = Promise.reject({ error: 'context_name_is_invalid' });
    }
    return promixe;
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
