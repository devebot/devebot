'use strict';

const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');

const commandConfig = {};

const commandObject = {
  info: {
    alias: 'app-info',
    description: 'Display application information',
    options: []
  },
  handler: function(options, payload, ctx) {
    const L = this.loggingFactory.getLogger();
    const T = this.loggingFactory.getTracer();

    T && L && L.has('dunce') && L.log('dunce', 'app-info is invoked with: %s', JSON.stringify(options));
    return Promise.resolve([{
      type: 'json',
      title: 'Application Information',
      data: chores.pickProperty('appInfo', [ctx, this, commandConfig], {})
    }]);
  }
};

module.exports = function(params) {
  lodash.merge(commandConfig, params);
  return commandObject;
};
