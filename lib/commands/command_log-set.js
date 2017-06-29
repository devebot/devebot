'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Enable/disable transports and change its logging levels',
    options: [
      {
        abbr: 't',
        name: 'transports',
        description: 'The list of transports will be adjusted',
        required: false
      },
      {
        abbr: 'e',
        name: 'enabled',
        description: 'The enabled state (true/false) applied for transports',
        required: false
      },
      {
        abbr: 'l',
        name: 'level',
        description: 'The new level label applied for transports',
        required: false
      }
    ]
  },
  handler: function(opts, ctx) {
    opts = opts || {};
    
    var loggingFactory = chores.pickProperty('loggingFactory', [ctx, this, commandConfig], {});
    
    var transports = opts['transports'];
    var transportList = (lodash.isEmpty(transports) ? null : transports.split(','));
    
    if (opts['enabled']) {
      var enabled = (opts['enabled'] == false || opts['enabled'] == 'false') ? false : true;
      loggingFactory.getLogger().activate(enabled, transportList);
    }
    
    if (opts['level']) {
      var level = opts['level'];
      loggingFactory.getLogger().setLevel(level, transportList);
    }
    
    return Promise.resolve({currentLogLevel: level});
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
