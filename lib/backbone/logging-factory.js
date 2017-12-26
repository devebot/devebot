'use strict';

var lodash = require('lodash');
var LogFactory = require('logdapter');
var LogAdapter = require('logolite').LogAdapter;
var LogConfig = require('logolite').LogConfig;
var LogTracer = require('logolite').LogTracer;
var chores = require('../utils/chores.js');

var DEFAULT_BRANCH_ID_FIELD = 'blockId';
var DEFAULT_BRANCH_NAME_FIELD = 'blockName';
var DEFAULT_BRANCH_NAME = chores.getBlockRef(__filename);

var Service = function(params) {
  params = params || {};
  var logFactory = new LogFactory(transformConfig(params.profileConfig));

  lodash.assign(this, lodash.mapValues(lodash.pick(logFactory, [
    'getServiceInfo', 'getServiceHelp'
  ]), function(item) {
    return item.bind(logFactory);
  }));

  var originalLogger = logFactory.getLogger();
  LogAdapter.connectTo(originalLogger);

  var logoliteLogger = {};
  var logoliteTracer = null;

  var self = this;

  this.getLogger = function(opts) {
    var logger = null;
    if (opts) {
      if (opts.type === 'origin' || opts.origin === true) {
        logger = originalLogger;
      } else
      if (opts.type === 'shadow' || opts.shadow === true) {
        logger = LogAdapter.getRootLogger();
      }
    }
    if (logger == null) {
      opts = lodash.omit(opts, ['type', 'origin', 'shadow']);
      opts.scope = opts.scope || DEFAULT_BRANCH_NAME;
      logoliteLogger[opts.scope] = logoliteLogger[opts.scope] || LogAdapter.getLogger(opts);
      logger = logoliteLogger[opts.scope];
    }
    return logger;
  }

  this.getTracer = function() {
    if (logoliteTracer == null) {
      logoliteTracer = LogTracer.ROOT.branch({
        key: DEFAULT_BRANCH_ID_FIELD,
        value: LogTracer.getLogID()
      });
      var blockInfo = {
        parentKey: LogTracer.ROOT.key,
        parentValue: LogTracer.ROOT.value
      };
      blockInfo[DEFAULT_BRANCH_NAME_FIELD] = 'devebot';
      var rootLogger = self.getLogger();
      rootLogger.has('info') && rootLogger.log('info', logoliteTracer.add(blockInfo)
          .toMessage({ reset: true }));
    }
    return logoliteTracer;
  }

  var branch = function(branchName, branchId) {
    var parentTracer = this.getTracer();

    var subTracer = parentTracer.branch({
      key: DEFAULT_BRANCH_ID_FIELD,
      value: branchId || LogTracer.getLogID()
    });

    var blockInfo = {
      parentKey: parentTracer.key,
      parentValue: parentTracer.value
    }
    if (branchName) {
      blockInfo[DEFAULT_BRANCH_NAME_FIELD] = branchName;
    }
    var rootLogger = self.getLogger();
    rootLogger.has('info') && rootLogger.log('info', subTracer.add(blockInfo)
        .toMessage({ reset: true }));

    var child = {};
    child.branch = branch.bind(child);
    child.getLogger = function(opts) {
      return self.getLogger(lodash.defaults({ scope: branchName }, opts));
    }
    child.getTracer = function() {
      return subTracer;
    }
    return child;
  }

  this.branch = branch.bind(this);
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

Service.reset = function() {
  LogConfig.reset();
  LogTracer.reset();
}

module.exports = Service;
