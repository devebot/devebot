'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var debugx = require('../utils/debug.js')('devebot:command:runhook:call');

var commandConfig;

var commandObject = {
  info: {
    description: 'Call a runhook',
    options: []
  },
  handler: function(opts, ctx) {
    debugx.enabled && debugx('runhook-list is invoked: %s', JSON.stringify(opts));
    var sandboxManager = this.sandboxManager;
    var runhookManager = sandboxManager.getSandboxService('runhookManager');

    var runhookDefs = runhookManager.getDefinitions();
    return Promise.resolve([{
      type: 'json',
      title: 'Runhook lists',
      data: runhookDefs
    }]);
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
