'use strict';

var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Display the database information (connection, data summary)',
    options: []
  },
  handler: function(params, ctx) {
    params = params || {};
    ctx = ctx || {};

    var self = this;
    var loggingFactory = ctx.loggingFactory || self.loggingFactory || commandConfig.loggingFactory;
    var sandboxManager = ctx.sandboxManager || self.sandboxManager || commandConfig.sandboxManager;

    var mongodbHelper = sandboxManager.getSandboxService('mongodbHelper');
    var mongodbTrigger = sandboxManager.getSandboxService('mongodbTrigger');

    var mongodb_helper_info = mongodbHelper.getServiceInfo();
    var mongodb_trigger_info = mongodbTrigger.getServiceInfo();

    var blocks = [];
    return Promise.resolve().then(function() {
      blocks.push({
        type: 'record',
        title: 'MongoDB connection information',
        label: {
          sandbox_name: 'Current sanbox',
          mongodb_url: 'Mongo URL',
          mongodb_trigger_url: 'Oplog Source'
        },
        data: {
          sandbox_name: mongodbHelper.getSandboxName(),
          mongodb_url: mongodb_helper_info.url,
          mongodb_trigger_url: mongodb_trigger_info.url
        }
      });
      return mongodbHelper.getDocumentSummary();
    }).then(function(countResult) {
      blocks.push({
        type: 'record',
        title: 'MongoDB document summary',
        label: countResult.label,
        data: countResult.count
      });
      return Promise.resolve(blocks);
    });
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
