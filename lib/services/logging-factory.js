'use strict';

var Logdapter = require('logdapter');

var Service = function(params) {
  params = params || {};
  var logdapter = new Logdapter(params.profileconfig || {});
  this.getLogger = logdapter.getLogger;
};

Service.argumentSchema = {
  "id": "/loggingFactory",
  "type": "object",
  "properties": {
    "profileconfig": {
      "type": "object"
    }
  }
};

Service.defaultLogger = Logdapter.defaultLogger;

Service.prototype.defaultLogger = Service.defaultLogger;

module.exports = Service;
