'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores');

var commandConfig;

var commandObject = {
  info: {
    alias: 'log-set',
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
  handler: function(options, payload, ctx) {
    options = options || {};
    
    var loggingFactory = chores.pickProperty('loggingFactory', [ctx, this, commandConfig], {});
    var originLogger = loggingFactory.getLogger({ type: 'origin' });

    var transports = options['transports'];
    var transportList = (lodash.isEmpty(transports) ? null : transports.split(','));
    
    if (options['enabled']) {
      var enabled = (options['enabled'] == false || options['enabled'] == 'false') ? false : true;
      originLogger.activate(transportList, enabled);
    }
    
    if (options['level']) {
      var level = options['level'];
      originLogger.setLevel(level, transportList);
    }
    
    return Promise.resolve({currentLogLevel: level});
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
