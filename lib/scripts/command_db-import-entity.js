'use strict';

var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');
var Devebot = require('devebot');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Import all of data of a collection/table from CSV to Database',
    options: [
      {
        abbr: 'e',
        name: 'entity',
        description: 'The name of collection/table should be imported',
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
    var jobqueueAdapter = sandboxManager.getSandboxService('jobqueueAdapter');

    var listeners = { ws: socket };
    
    var entityName = params['entity'];
    var promixe = jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.IMPORT, entityName, 'merge', {}, listeners);
    return promixe;
  }
};

module.exports = function(params) {
  Devebot.logger.trace('<command> - %s is loading...', __filename);
  commandConfig = params || {};
  return commandObject;
};
