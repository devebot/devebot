'use strict';

var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');
var Devebot = require('devebot');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Changes logging level for one or more transports',
    options: [
      {
        abbr: 'l',
        name: 'level',
        description: 'The new level label applied for transports',
        required: true
      },
      {
        abbr: 't',
        name: 'transports',
        description: 'The list of transports will be applied new level',
        required: false
      }
    ]
  },
  handler: function(params, ctx) {
    params = params || {};
    ctx = ctx || {};

    var self = this;
    var loggingFactory = ctx.loggingFactory || self.loggingFactory || commandConfig.loggingFactory;
    
    var level = params['level'];
    var transports = params['transports'];
    var promixe = Promise.resolve().then(function() {
      var transportList = (lodash.isEmpty(transports) ? null : transports.split(','));
      loggingFactory.getLogger().setLevel(level, transportList);
      return {currentLogLevel: level};
    });
    return promixe;
  }
};

module.exports = function(params) {
  Devebot.logger.trace('<command> - %s is loading...', __filename);
  commandConfig = params || {};
  return commandObject;
};
