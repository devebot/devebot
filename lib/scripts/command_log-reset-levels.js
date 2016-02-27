'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Resets logging level to the default levels',
    options: []
  },
  handler: function(params, ctx) {
    params = params || {};
    ctx = ctx || {};

    var self = this;
    var loggingFactory = ctx.loggingFactory || self.loggingFactory || commandConfig.loggingFactory;
    
    var promixe = Promise.resolve().then(function() {
      loggingFactory.getLogger().resetDefaultLevels();
      return {status: 'ok'};
    });
    return promixe;
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
