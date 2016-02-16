'use strict';

var Promise = require('bluebird');
var async = require('async');
var lodash = require('lodash');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Destroy all of old data/structure of database and initialize the new structure',
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
  commandConfig = params || {};
  return commandObject;
};
