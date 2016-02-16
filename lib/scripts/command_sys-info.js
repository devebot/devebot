'use strict';

var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Display the system information (configuration, mongodb, elasticsearch, ...)',
    options: []
  },
  handler: function(params, ctx) {
    params = params || {};
    ctx = ctx || {};

    var self = this;
    var loggingFactory = ctx.loggingFactory || self.loggingFactory || commandConfig.loggingFactory;
    var sandboxManager = ctx.sandboxManager || self.sandboxManager || commandConfig.sandboxManager;

    var logging_factory_info = {}; //loggingFactory.getServiceInfo();
    var elasticsearchHelper = sandboxManager.getSandboxService('elasticsearchHelper');
    var mongodbHelper = sandboxManager.getSandboxService('mongodbHelper');

    var promixe = Promise.all([
      mongodbHelper.stats(),
      elasticsearchHelper.getClusterStats()
    ]);
    return promixe;
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
