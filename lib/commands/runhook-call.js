'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var debugx = require('../utils/pinbug.js')('devebot:command:runhook:call');

var commandConfig;

var commandObject = {
  info: {
    description: 'Call a runhook',
    options: [{
      abbr: 'n',
      name: 'name',
      description: 'The name of runhook',
      required: true
    }, {
      abbr: 'd',
      name: 'data',
      description: 'The data of runhook (JSON object string)',
      required: false,
      parser: function(val) {
        return JSON.parse(val);
      }
    }, {
      abbr: 'm',
      name: 'mode',
      description: 'The running mode ("direct"/"rpc")',
      required: false
    }, {
      abbr: 'p',
      name: 'plugin',
      description: 'The parent of runhook',
      required: false
    }]
  },
  handler: function(opts, ctx) {
    debugx.enabled && debugx('runhook-call is invoked: %s', JSON.stringify(opts));
    var sandboxManager = this.sandboxManager;
    var runhookManager = sandboxManager.getSandboxService('runhookManager');

    var runhook = {};
    runhook.name = opts.name;
    runhook.data = JSON.parse(opts.data) || {};
    runhook.mode = opts.mode;

    return runhookManager.execute(runhook, ctx).then(function(result) {
      debugx.enabled && debugx('runhookManager.execute() successfully finished: %s', JSON.stringify(result));
      return Promise.resolve(result);
    }).catch(function(error) {
      debugx.enabled && debugx('runhookManager.execute() has been failed: %s', JSON.stringify(error));
      return Promise.reject(error);
    });
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
