'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Plugin2 - Routine1',
    options: []
  },
  handler: function(opts, ctx) {
    return Promise.resolve([{
        type: 'json',
        title: 'Plugin2 - Routine1',
        data: {}
    }]);
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
