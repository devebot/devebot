'use strict';

var lodash = require('lodash');
var Logdapter = require('logdapter');

var Service = function(params) {
  params = params || {};
  var logdapter = new Logdapter(transformConfig(params.profileConfig));

  lodash.assign(this, lodash.mapValues(lodash.pick(logdapter, [
    'getLogger', 'getServiceInfo', 'getServiceHelp'
  ]), function(item) {
    return item.bind(logdapter);
  }));
};

var transformConfig = function(profileConfig) {
  profileConfig = profileConfig || {};
  
  var loggerConfig = profileConfig.logger;
  if (!lodash.isObject(loggerConfig)) return profileConfig;
  
  var transportDefs = loggerConfig.transports;
  if (!lodash.isObject(transportDefs)) return profileConfig;
  
  var transports = [];
  lodash.forOwn(transportDefs, function(transportDef, key) {
    if (lodash.isObject(transportDef)) {
      if (!transportDef.type) {
        transportDef.type = key;
      }
      transports.push(transportDef);
    }
  });
  profileConfig.logger.transports = transports;

  return profileConfig;
};

Service.argumentSchema = {
  "id": "loggingFactory",
  "type": "object",
  "properties": {
    "profileConfig": {
      "type": "object"
    }
  }
};

Service.defaultLogger = Logdapter.defaultLogger;

Service.prototype.defaultLogger = Service.defaultLogger;

module.exports = Service;
