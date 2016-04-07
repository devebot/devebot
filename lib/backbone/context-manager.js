'use strict';

var events = require('events');
var util = require('util');

var Service = function(params) {
  var self = this;
  params = params || {};
};

Service.argumentSchema = {
  "id": "contextManager",
  "type": "object",
  "properties": {
    "sandboxName": {
      "type": "string"
    },
    "sandboxConfig": {
      "type": "object"
    }
  }
};

util.inherits(Service, events.EventEmitter);

module.exports = Service;
