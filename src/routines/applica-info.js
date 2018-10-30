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
    let L = this.loggingFactory.getLogger();
    let T = this.loggingFactory.getTracer();

    L.has('dunce') && L.log('dunce', 'app-info is invoked with: %s', JSON.stringify(options));
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
