'use strict';

var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');
var Devebot = require('devebot');

var commandConfig;

var commandObject = {
  info: {
    description: 'Display the elasticsearch information (settings, mappings)',
    options: []
  },
  handler: function(params, ctx) {
    params = params || {};
    ctx = ctx || {};

    var self = this;
    var loggingFactory = ctx.loggingFactory || self.loggingFactory || commandConfig.loggingFactory;
    var sandboxManager = ctx.sandboxManager || self.sandboxManager || commandConfig.sandboxManager;

    var elasticsearchHelper = sandboxManager.getSandboxService('elasticsearchHelper');

    var blocks = [];
    return Promise.resolve().then(function() {
      blocks.push({
        type: 'record',
        title: 'Elasticsearch connection information',
        label: {
          sandbox_name: 'Current sanbox',
          index_url: 'Index URL'
        },
        data: {
          sandbox_name: elasticsearchHelper.getSandboxName(),
          index_url: elasticsearchHelper.es_index_url
        }
      });
      return Promise.all([
        elasticsearchHelper.getIndexSettings(),
        elasticsearchHelper.getIndexMappings()
      ]);
    }).then(function(info) {
      info = info || [];
      if (info[0]) {
        blocks.push({
          type: 'json',
          title: 'Elasticsearch Index settings',
          data: info[0]
        });
      }
      if (info[1]) {
        blocks.push({
          type: 'json',
          title: 'Elasticsearch Index mappings',
          data: info[1]
        });
      }
      return (info.length >= 2) ? info[1] : {};
    }).then(function(mappings) {
      return elasticsearchHelper.getDocumentSummary(mappings);
    }).then(function(countResult) {
      blocks.push({
        type: 'record',
        title: 'Elasticsearch document summary',
        label: countResult.label,
        data: countResult.count
      });
      return Promise.resolve(blocks);
    });
  }
};

module.exports = function(params) {
  Devebot.logger.trace('<command> - %s is loading...', __filename);
  commandConfig = params || {};
  return commandObject;
};
