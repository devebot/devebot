'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');
var logger = require('../utils/logger.js');

var Service = function(params) {
  var self = this;
  params = params || {};
};

Service.argumentSchema = {
  "id": "/contextManager",
  "type": "object",
  "properties": {
    "sandboxname": {
      "type": "string"
    },
    "configuration": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
