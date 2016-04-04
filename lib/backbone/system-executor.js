'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var spawn = require('cross-spawn');

var debuglog = require('../utils/debug.js')('devebot:systemExecutor');

var Service = function(params) {
  debuglog(' + constructor start ...');
  Service.super_.apply(this);
  
  var self = this;
  params = params || {};
  
  debuglog(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "systemExecutor",
  "type": "object",
  "properties": {
    "profileconfig": {
      "type": "object"
    },
    "generalconfig": {
      "type": "object"
    }
  }
};

/**
 * Normalize a command across OS and spawn it (asynchronously).
 *
 * @param {String} command
 * @param {Array} args
 * @param {object} [opt]
 */
Service.prototype.spawnCommand = function spawnCommand(command, args, opt) {
  opt = opt || {};
  return spawn(command, args, lodash.defaults(opt, { stdio: 'inherit' }));
};

/**
 * Normalize a command across OS and spawn it (synchronously).
 *
 * @param {String} command
 * @param {Array} args
 * @param {object} [opt]
 */
Service.prototype.spawnCommandSync = function spawnCommandSync(command, args, opt) {
  opt = opt || {};
  return spawn.sync(command, args, lodash.defaults(opt, { stdio: 'inherit' }));
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
