'use strict';

var Promise = require('bluebird');
var async = require('async');
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

    var elasticsearchHelper = sandboxManager.getSandboxService('elasticsearchHelper');
    var mongodbHelper = sandboxManager.getSandboxService('mongodbHelper');
    var mongodbTrigger = sandboxManager.getSandboxService('mongodbTrigger');

    var elasticsearch_helper_info = elasticsearchHelper.getServiceInfo();
    var mongodb_helper_info = mongodbHelper.getServiceInfo();
    var mongodb_trigger_info = mongodbTrigger.getServiceInfo();

    var blocks = [];
    blocks.push({
      type: 'record',
      title: 'Connection information',
      label: {
        sandbox_pointer: 'Current sanbox',
        es_index_name: 'ES Index name',
        es_index_url: 'ES Index URL',
        mongodb_url: 'Mongo URL',
        mongodb_cols: 'Mongo collections',
        mongodb_trigger_url: 'Oplog Source',
      },
      data: {
        sandbox_pointer: sandboxManager.getSandboxPointer(),
        es_index_url: elasticsearch_helper_info.url,
        es_index_name: elasticsearch_helper_info.connection_info.name,
        mongodb_url: mongodb_helper_info.url,
        mongodb_cols: JSON.stringify(mongodb_helper_info.collection_defs, null, 2),
        mongodb_trigger_url: mongodb_trigger_info.url
      }
    });
    return Promise.resolve(blocks);
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
