'use strict';

var lodash = require('lodash');
var LogFactory = require('logdapter');
var LogAdapter = require('logolite').LogAdapter;
var LogTracer = require('logolite').LogTracer;

var Service = function(params) {
  params = params || {};
  var logFactory = new LogFactory(transformConfig(params.profileConfig));

  lodash.assign(this, lodash.mapValues(lodash.pick(logFactory, [
    'getServiceInfo', 'getServiceHelp'
  ]), function(item) {
    return item.bind(logFactory);
  }));

  var originTracer = LogTracer.ROOT;
  var originLogger = logFactory.getLogger();
  var wrappedLogger = null;

  LogAdapter.connectTo(originLogger);

  var self = this;

  var branch = function(serviceName, serviceId) {
    var newTracer = this.getTracer();
    if (serviceName) {
      serviceId = serviceId || LogTracer.getLogID();
      newTracer = newTracer.branch({ key: 'serviceName', value: wrapperName })
            .branch({ key: 'serviceId', value: LogTracer.getLogID() })
    }
    var child = {};
    child.branch = branch.bind(child);
    child.getLogger = self.getLogger;
    child.getTracer = function() {
      return newTracer;
    }
    return child;    
  }

  this.branch = branch.bind(this);

  this.getLogger = function(opts) {
    var logger;
    if (opts && opts.wrapped) {
      wrappedLogger = wrappedLogger || LogAdapter.getLogger();
      logger = wrappedLogger;
    } else {
      logger = originLogger;
    }
    return logger;
  }

  this.getTracer = function() {
    return originTracer;
  }

  this.getWrappedLogger = function() {
    return wrappedLogger = wrappedLogger || LogAdapter.getLogger();
  }
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

Service.defaultLogger = LogFactory.defaultLogger;

Service.prototype.defaultLogger = Service.defaultLogger;

module.exports = Service;
