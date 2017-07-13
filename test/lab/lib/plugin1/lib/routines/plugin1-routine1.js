'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var runhookSetting;

var runhookDialect = {
  info: {
  	description: 'Plugin1 - Routine1',
    options: []
  },
  mode: 'direct',
  handler: function(opts, ctx) {
    return Promise.resolve([{
        type: 'json',
        title: 'Plugin1 - Routine1',
        data: {}
    }]);
  }
};

module.exports = function(params) {
  runhookSetting = params || {};
  return runhookDialect;
};
