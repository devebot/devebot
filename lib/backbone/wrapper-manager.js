'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');

var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var debuglog = require('../utils/debug.js')('devebot:wrapperManager');

var Service = function(params) {
  debuglog(' + constructor start ...');
  Service.super_.apply(this);
  
  var self = this;
  params = params || {};
  
  debuglog(' - constructor has finished');
};

Service.argumentSchema = {
  "id": "/wrapperManager",
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

util.inherits(Service, events.EventEmitter);

module.exports = Service;
