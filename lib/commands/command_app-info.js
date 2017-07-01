'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');
var debugx = require('../utils/debug.js')('devebot:command:app:info');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Display application information',
    options: []
  },
  handler: function(opts, ctx) {
    debugx.enabled && debugx('app-info is invoked with: %s', JSON.stringify(opts));
    return Promise.resolve([{
        type: 'json',
        title: 'Application Information',
        data: chores.pickProperty('appinfo', [ctx, this, commandConfig], {})
    }]);
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
