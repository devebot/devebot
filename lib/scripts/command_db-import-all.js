'use strict';

var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Destroy all of old data/structure and initialize the new structure',
    options: []
  },
  handler: function(params, ctx) {
    params = params || {};
    ctx = ctx || {};

    var self = this;
    var loggingFactory = ctx.loggingFactory || self.loggingFactory || commandConfig.loggingFactory;
    var sandboxManager = ctx.sandboxManager || self.sandboxManager || commandConfig.sandboxManager;
    var jobqueueAdapter = sandboxManager.getSandboxService('jobqueueAdapter');

    var listeners = { ws: socket };
    
    var entityNames = jobqueueAdapter.getRunhookEntities(constx.RUNHOOK.KEY.IMPORT);
    lodash.remove(entityNames, function(item) {
      return item == constx.RUNHOOK.ENTITY.GLOBAL;
    });
    var promixe = Promise.map(entityNames, function(entityName) {
      return jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.IMPORT, entityName, 'merge', {}, listeners);
    });
    return promixe;
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
