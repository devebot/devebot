'use strict';

var events = require('events');
var util = require('util');

var Service = function(params) {
  var self = this;
  params = params || {};
};

Service.argumentSchema = {
  "id": "/serviceManager",
  "type": "object",
  "properties": {
    "sandboxname": {
      "type": "string"
    },
    "sandboxconfig": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
