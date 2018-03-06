'use strict';

var lodash = require('lodash');
var LogFactory = require('logzilla');
var LogAdapter = require('logolite').LogAdapter;
var LogConfig = require('logolite').LogConfig;
var LogTracer = require('logolite').LogTracer;
var chores = require('../utils/chores.js');
var constx = require('../utils/constx.js');

var DEFAULT_SECTOR_NAME = chores.getBlockRef(__filename);

var Service = function(params) {
  params = params || {};

  var more = {};
  var logFactory = new LogFactory(transformConfig(params.profileConfig, more));

  lodash.assign(this, lodash.mapValues(lodash.pick(logFactory, [
    'getServiceInfo', 'getServiceHelp'
  ]), function(item) {
    return item.bind(logFactory);
  }));

  return new LoggingFactory({
    sectorName: 'devebot',
    mappings: more.mappings,
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
        opts.sector = opts.sector || DEFAULT_SECTOR_NAME;
        logoliteLogger[opts.sector] = logoliteLogger[opts.sector] || LogAdapter.getLogger(opts);
        logger = logoliteLogger[opts.sector];
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

  this.branch = function(sectorName, sectorId) {
    return new LoggingFactory({
      root: args.root,
      parent: self,
      sectorName: sectorName,
      sectorId: sectorId
    });
  }

  this.getLogger = function(opts) {
    return args.root.getLogger(lodash.defaults({ sector: args.sectorName }, opts));
  }

  var subTracer = null;
  this.getTracer = function() {
    var parentTracer = args.parent.getTracer();
    if (subTracer == null) {
      subTracer = parentTracer.branch({
        key: constx.TRACER.SECTOR.ID_FIELD,
        value: args.sectorId || LogTracer.getLogID()
      });

      var blockInfo = {
        parentKey: parentTracer.key,
        parentValue: parentTracer.value
      }
      if (args.sectorName) {
        blockInfo[constx.TRACER.SECTOR.NAME_FIELD] = args.sectorName;
      }
      var rootLogger = args.root.getLogger();
      rootLogger.has('info') && rootLogger.log('info', subTracer.add(blockInfo)
          .toMessage({ tags: [ 'devebot-metadata' ] }));
    }
    return subTracer;
  }

  this.getLogger();
  this.getTracer();
};

var transformConfig = function(profileConfig, derivative) {
  profileConfig = profileConfig || {};
  var loggingConfig = profileConfig.logger;

  derivative = derivative || {};
  if (lodash.isObject(loggingConfig)) {
    var labels = transformLoggingLabels(loggingConfig.labels);

    derivative.mappings = labels.mappings;
    loggingConfig.levels = lodash.isEmpty(labels.levels) ? constx.LOGGER.LEVELS : labels.levels;
    loggingConfig.colors = lodash.isEmpty(labels.colors) ? constx.LOGGER.COLORS : labels.colors;

    var transportDefs = loggingConfig.transports;
    if (lodash.isObject(transportDefs)) {
      var transports = [];
      lodash.forOwn(transportDefs, function(transportDef, key) {
        if (lodash.isObject(transportDef)) {
          if (!transportDef.type) {
            transportDef.type = key;
          }
          transports.push(transportDef);
        }
      });
      loggingConfig.transports = transports;
    }
  };

  profileConfig.logger = loggingConfig;
  return profileConfig;
};

var transformLoggingLabels = function(loglabelConfig) {
  if (lodash.isEmpty(loglabelConfig)) return {};
  var result = { levels: {}, colors: {}, mappings: {} };
  lodash.forOwn(loglabelConfig, function(info, label) {
    result.levels[label] = info.level;
    result.colors[label] = info.color;
    if (lodash.isString(info.link) && !lodash.isEmpty(info.link)) {
      result.mappings[info.link] = label;
    }
  });
  return result;
}

Service.argumentSchema = {
  "$id": "loggingFactory",
  "type": "object",
  "properties": {
    "profileConfig": {
      "type": "object"
    }
  }
};

Service.reset = function() {
  LogConfig.reset();
  LogTracer.reset();
}

module.exports = Service;
