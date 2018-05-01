'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');

let commandConfig;

let commandObject = {
  info: {
    alias: 'app-info',
    description: 'Display application information',
    options: []
  },
  handler: function(options, payload, ctx) {
    let LX = this.loggingFactory.getLogger();
    let LT = this.loggingFactory.getTracer();

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
