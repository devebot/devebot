'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var logger = require('../utils/logger.js');

var Service = function(params) {
  var self = this;
  params = params || {};
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;

Service.prototype.loadConfig = function(configDir) {
  
}

module.exports = Service;