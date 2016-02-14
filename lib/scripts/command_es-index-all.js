'use strict';

var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');
var Devebot = require('devebot');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Indexing all of data from MongoDB to Elasticsearch',
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
    
    var entityNames = jobqueueAdapter.getRunhookEntities(constx.RUNHOOK.KEY.INDEX);
    lodash.remove(entityNames, function(item) {
      return item == constx.RUNHOOK.ENTITY.GLOBAL;
    });
    var promixe = Promise.map(entityNames, function(entityName) {
      return jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.INDEX, entityName, 'all', {}, listeners);
    });
    return promixe;
  }
};

module.exports = function(params) {
  Devebot.logger.trace('<command> - %s is loading...', __filename);
  commandConfig = params || {};
  return commandObject;
};
