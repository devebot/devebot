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

  var logoliteLogger = null;
  var logoliteTracer = LogTracer.ROOT;

  var originalLogger = logFactory.getLogger();
  LogAdapter.connectTo(originalLogger);

  var self = this;

  var branch = function(blockName, blockId) {
    var rootLogger = self.getLogger({ wrapped: true });
    var parentTracer = this.getTracer();

    blockId = blockId || LogTracer.getLogID();
    var subTracer = parentTracer.branch({ key: 'blockId', value: blockId });

    if (blockName) {
      rootLogger.has('info') && rootLogger.log('info', subTracer.add({
        parentkey: parentTracer.key,
        parentValue: parentTracer.value,
        blockName: blockName
      }).toMessage({ reset: true }));
    }

    var child = {};
    child.branch = branch.bind(child);
    child.getLogger = self.getLogger;
    child.getTracer = function() {
      return subTracer;
    }
    return child;
  }

  this.branch = branch.bind(this);

  this.getLogger = function(opts) {
    var logger;
    if (opts && opts.wrapped) {
      logger = logoliteLogger = logoliteLogger || LogAdapter.getLogger();
    } else {
      logger = originalLogger;
    }
    return logger;
  }

  this.getTracer = function() {
    return logoliteTracer;
  }

  // @Deprecated
  this.getWrappedLogger = function() {
    return logoliteLogger = logoliteLogger || LogAdapter.getLogger();
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
