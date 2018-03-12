'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');

var commandConfig;

var commandObject = {
  info: {
    alias: 'app-info',
    description: 'Display application information',
    options: []
  },
  handler: function(options, payload, ctx) {
    var LX = this.loggingFactory.getLogger();
    var LT = this.loggingFactory.getTracer();

    LX.has('conlog') && LX.log('conlog', 'app-info is invoked with: %s', JSON.stringify(options));
    return Promise.resolve([{
        type: 'json',
        title: 'Application Information',
        data: chores.pickProperty('appInfo', [ctx, this, commandConfig], {})
    }]);
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
