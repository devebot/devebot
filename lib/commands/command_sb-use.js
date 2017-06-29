'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var chores = require('../utils/chores.js');

var commandConfig;

var commandObject = {
  info: {
  	description: 'Set the current sandbox to work',
    options: [
      {
        abbr: 'n',
        name: 'name',
        description: 'Name of the new current sandbox',
        required: true
      }
    ]
  },
  handler: function(params, ctx) {
    var promixe;
    var sandboxName = params['name'];
    var sandboxManager = chores.pickProperty('sandboxManager', [ctx, this, commandConfig], {});
    if (sandboxManager.isSandboxAvailable(sandboxName)) {
      sandboxManager.setSandboxPointer(sandboxName);
      promixe = Promise.resolve({ currentSandbox: sandboxName });
    } else {
      promixe = Promise.reject({ error: 'invalid_sandbox_name' });
    }
    return promixe;
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
