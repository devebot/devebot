'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var runhookSetting;

var runhookDialect = {
  info: {
    description: 'Plugin1 - Routine2',
    options: []
  },
  handler: function(opts, ctx) {
    return Promise.resolve([{
        type: 'json',
        title: 'Plugin1 - Routine2',
        data: {}
    }]);
  }
};

module.exports = function(params) {
  runhookSetting = params || {};
  return runhookDialect;
};
