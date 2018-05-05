'use strict';

const lodash = require('lodash');
const LogFactory = require('logzilla');
const LogAdapter = require('logolite').LogAdapter;
const LogConfig = require('logolite').LogConfig;
const LogTracer = require('logolite').LogTracer;
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const DEFAULT_SECTOR_NAME = chores.getBlockRef(__filename);

function LoggingService(params) {
  params = params || {};

  let more = {};
  let logFactory = new LogFactory(transformLoggingConfig(params.profileConfig, more));

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

let LoggingFactory = function(args) {
  args = args || {};

  args.root = args.root || {};
  if (!lodash.isFunction(args.root.getLogger)) {
    if (lodash.isEmpty(args.originalLogger)) {
      throw new Error('The root LoggingFactory must be provided the originalLogger');
    }

    let logoliteLogger = {};
    let originalLogger = args.originalLogger;
    LogAdapter.connectTo(originalLogger);

    args.root.getLogger = function(opts) {
      let logger = null;
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
        if (args.mappings) {
          opts.mappings = args.mappings;
        }
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

  let self = this;

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

  let subTracer = null;
  this.getTracer = function() {
    let parentTracer = args.parent.getTracer();
    if (subTracer == null) {
      subTracer = parentTracer.branch({
        key: constx.TRACER.SECTOR.ID_FIELD,
        value: args.sectorId || LogTracer.getLogID()
      });

      let blockInfo = {
        parentKey: parentTracer.key,
        parentValue: parentTracer.value
      }
      if (args.sectorName) {
        blockInfo[constx.TRACER.SECTOR.NAME_FIELD] = args.sectorName;
      }
      let rootLogger = args.root.getLogger();
      rootLogger.has('info') && rootLogger.log('info', subTracer.add(blockInfo)
          .toMessage({ tags: [ 'devebot-metadata' ] }));
    }
    return subTracer;
  }

  this.getLogger();
  this.getTracer();
};

let transformLoggingConfig = function(profileConfig, derivative) {
  profileConfig = profileConfig || {};
  let loggingConfig = profileConfig.logger;

  derivative = derivative || {};
  if (lodash.isObject(loggingConfig)) {
    let defaultLabels = transformLoggingLabels(constx.LOGGER.LABELS);
    let labels = transformLoggingLabels(loggingConfig.labels);

    derivative.mappings = labels.mappings;
    loggingConfig.levels = lodash.isEmpty(labels.levels) ? defaultLabels.levels : labels.levels;
    loggingConfig.colors = lodash.isEmpty(labels.colors) ? defaultLabels.colors : labels.colors;
    delete loggingConfig.labels;

    let transportDefs = loggingConfig.transports;
    if (lodash.isObject(transportDefs)) {
      let transports = [];
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

let transformLoggingLabels = function(loglabelConfig) {
  if (lodash.isEmpty(loglabelConfig)) return {};
  let result = { levels: {}, colors: {}, mappings: {} };
  lodash.forOwn(loglabelConfig, function(info, label) {
    result.levels[label] = info.level;
    result.colors[label] = info.color;
    let links = lodash.isArray(info.inflow) ? info.inflow : [info.inflow];
    lodash.forEach(links, function(link) {
      if (lodash.isString(link) && !lodash.isEmpty(link)) {
        result.mappings[link] = label;
      }
    });
  });
  return result;
};

LoggingService.argumentSchema = {
  "$id": "loggingFactory",
  "type": "object",
  "properties": {
    "profileConfig": {
      "type": "object"
    }
  }
};

LoggingService.reset = function() {
  LogConfig.reset();
  LogTracer.reset();
}

module.exports = LoggingService;
