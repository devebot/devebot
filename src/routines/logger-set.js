'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');

let commandConfig;

let commandObject = {
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
    
    let loggingFactory = chores.pickProperty('loggingFactory', [ctx, this, commandConfig], {});
    let originLogger = loggingFactory.getLogger({ type: 'origin' });

    let transports = options['transports'];
    let transportList = (lodash.isEmpty(transports) ? null : transports.split(','));
    
    if (options['enabled']) {
      let enabled = (options['enabled'] == false || options['enabled'] == 'false') ? false : true;
      originLogger.activate(transportList, enabled);
    }
    
    if (options['level']) {
      let level = options['level'];
      originLogger.setLevel(level, transportList);
    }
    
    return Promise.resolve({currentLogLevel: level});
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
