'use strict';

var lodash = require('lodash');
var Logdapter = require('logdapter');

var Service = function(params) {
  params = params || {};
  var logdapter = new Logdapter(transformConfig(params.profileconfig));

  lodash.assign(this, lodash.mapValues(lodash.pick(logdapter, [
    'getLogger', 'getServiceInfo', 'getServiceHelp'
  ]), function(item) {
    return item.bind(logdapter);
  }));
};

var transformConfig = function(profileconfig) {
  profileconfig = profileconfig || {};
  
  var loggerConfig = profileconfig.logger;
  if (!lodash.isObject(loggerConfig)) return profileconfig;
  
  var transportDefs = loggerConfig.transports;
  if (!lodash.isObject(transportDefs)) return profileconfig;
  
  var transports = [];
  lodash.forOwn(transportDefs, function(transportDef, key) {
    if (lodash.isObject(transportDef)) {
      if (!transportDef.type) {
        transportDef.type = key;
      }
      transports.push(transportDef);
    }
  });
  profileconfig.logger.transports = transports;

  return profileconfig;
};

Service.argumentSchema = {
  "id": "loggingFactory",
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
