'use strict';

var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');
var Devebot = require('devebot');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Display the logger information',
    options: []
  },
  handler: function(params, ctx) {
    params = params || {};
    ctx = ctx || {};

    var self = this;
    var loggingFactory = ctx.loggingFactory || self.loggingFactory || commandConfig.loggingFactory;
    var sandboxManager = ctx.sandboxManager || self.sandboxManager || commandConfig.sandboxManager;

    var promixe = Promise.resolve([]);
    
    return promixe;
  }
};

module.exports = function(params) {
  Devebot.logger.trace('<command> - %s is loading...', __filename);
  commandConfig = params || {};
  return commandObject;
};
