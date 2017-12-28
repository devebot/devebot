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

  return new LoggingFactory({
    branchName: 'devebot',
    originalLogger: logFactory.getLogger()
  });
};

var LoggingFactory = function(args) {
  args = args || {};

  args.root = args.root || {};
  if (!lodash.isFunction(args.root.getLogger)) {
    if (lodash.isEmpty(args.originalLogger)) {
      throw new Error('The root LoggingFactory must be provided the originalLogger');
    }

    var logoliteLogger = {};
    var originalLogger = args.originalLogger;
    LogAdapter.connectTo(originalLogger);

    args.root.getLogger = function(opts) {
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
  }

  args.parent = args.parent || {};
  if (!lodash.isFunction(args.parent.getTracer)) {
    args.parent.getTracer = function() {
      return LogTracer.ROOT;
    }
  };

  var self = this;

  this.branch = function(branchName, branchId) {
    return new LoggingFactory({
      root: args.root,
      parent: self,
      branchName: branchName,
      branchId: branchId
    });
  }

  this.getLogger = function(opts) {
    return args.root.getLogger(lodash.defaults({ scope: args.branchName }, opts));
  }

  var subTracer = null;
  this.getTracer = function() {
    var parentTracer = args.parent.getTracer();
    if (subTracer == null) {
      subTracer = parentTracer.branch({
        key: DEFAULT_BRANCH_ID_FIELD,
        value: args.branchId || LogTracer.getLogID()
      });

      var blockInfo = {
        parentKey: parentTracer.key,
        parentValue: parentTracer.value
      }
      if (args.branchName) {
        blockInfo[DEFAULT_BRANCH_NAME_FIELD] = args.branchName;
      }
      var rootLogger = args.root.getLogger();
      rootLogger.has('info') && rootLogger.log('info', subTracer.add(blockInfo)
          .toMessage({ tags: [ 'devebot-metadata' ], reset: true }));
    }
    return subTracer;
  }

  this.getLogger();
  this.getTracer();
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
