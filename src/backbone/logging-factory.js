'use strict';

const lodash = require('lodash');
const LogFactory = require('logzilla');
const LogAdapter = require('logolite').LogAdapter;
const LogConfig = require('logolite').LogConfig;
const LogTracer = require('logolite').LogTracer;
const chores = require('../utils/chores');
const constx = require('../utils/constx');
const nodash = require('../utils/nodash');
const DEFAULT_SECTOR_NAME = chores.getBlockRef(__filename);
const FRAMEWORK_METADATA = constx.FRAMEWORK.NAME + '-metadata';
const STAMP = constx.LOGGER.STARTING_POINT;

function LoggingService(params={}) {
  const more = {};
  const logFactory = new LogFactory(transformLoggingConfig(params.profileConfig, more));

  lodash.assign(this, lodash.mapValues(lodash.pick(logFactory, [
    'getServiceInfo', 'getServiceHelp'
  ]), function(item) {
    return item.bind(logFactory);
  }));

  return new LoggingFactory({
    sectorName: constx.FRAMEWORK.NAME,
    mappings: more.mappings,
    originalLogger: logFactory.getLogger()
  });
};

function LoggingFactory(args={}) {
  const _ref_ = {};
  args.root = args.root || {};
  if (!lodash.isFunction(args.root.getLogger)) {
    const originalLogger = args.originalLogger;
    if (lodash.isEmpty(originalLogger)) {
      throw new Error('The root LoggingFactory must be provided the originalLogger');
    }
    LogAdapter.connectTo(originalLogger, {
      onLevel: STAMP,
      mappings: args.mappings
    });

    const logoliteLogger = {};

    args.root.getLogger = function(opts) {
      if (opts) {
        if (opts.type === 'origin' || opts.origin === true) {
          return originalLogger;
        } else
        if (opts.type === 'shadow' || opts.shadow === true) {
          return LogAdapter.getRootLogger();
        }
      }
      opts = lodash.omit(opts, ['type', 'origin', 'shadow']);
      opts.sector = opts.sector || DEFAULT_SECTOR_NAME;
      if (args.mappings) {
        opts.mappings = args.mappings;
      }
      logoliteLogger[opts.sector] = logoliteLogger[opts.sector] || LogAdapter.getLogger(opts);
      return logoliteLogger[opts.sector];
    }
  }

  args.parent = args.parent || {};
  if (!lodash.isFunction(args.parent.getTracer)) {
    args.parent.getTracer = function() {
      return LogTracer.ROOT;
    }
  };

  this.branch = function(sectorName, sectorId) {
    const self = this;
    return new LoggingFactory({
      root: args.root,
      parent: self,
      sectorName: sectorName,
      sectorId: sectorId
    });
  }

  this.getLogger = function(opts) {
    return args.root.getLogger(lodash.defaults({
      sector: args.sectorName,
      mappings: args.mappings
    }, opts));
  }

  _ref_.subTracer = null;
  this.getTracer = function() {
    const parentTracer = args.parent.getTracer();
    if (_ref_.subTracer == null) {
      _ref_.subTracer = parentTracer.branch({
        key: constx.TRACER.SECTOR.ID_FIELD,
        value: args.sectorId || LogTracer.getLogID()
      });
      const blockInfo = {
        parentKey: parentTracer.key,
        parentValue: parentTracer.value
      }
      if (args.sectorName) {
        blockInfo[constx.TRACER.SECTOR.NAME_FIELD] = args.sectorName;
      }
      const rootLogger = args.root.getLogger();
      rootLogger.has(STAMP) && rootLogger.log(STAMP, _ref_.subTracer.add(blockInfo)
          .toMessage({ tags: [ FRAMEWORK_METADATA ] }));
    }
    return _ref_.subTracer;
  }

  this.getLogger();
  this.getTracer();
};

function transformLoggingConfig(profileConfig, derivative) {
  profileConfig = profileConfig || {};
  const loggingConfig = profileConfig.logger;

  derivative = derivative || {};
  if (lodash.isObject(loggingConfig)) {
    const defaultLabels = transformLoggingLabels(constx.LOGGER.LABELS);
    const labels = transformLoggingLabels(loggingConfig.labels, loggingConfig.mappings);

    derivative.mappings = labels.mappings;
    loggingConfig.levels = lodash.isEmpty(labels.levels) ? defaultLabels.levels : labels.levels;
    loggingConfig.colors = lodash.isEmpty(labels.colors) ? defaultLabels.colors : labels.colors;
    delete loggingConfig.labels;

    const transportDefs = loggingConfig.transports;
    if (lodash.isObject(transportDefs)) {
      const transports = [];
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

function transformLoggingLabels(loglabelConfig, loglabelMappings) {
  const result = {};
  if (!lodash.isEmpty(loglabelConfig)) {
    result.levels = {};
    result.colors = {};
    result.mappings = {};
    lodash.forOwn(loglabelConfig, function(info, label) {
      result.levels[label] = info.level;
      result.colors[label] = info.color;
      const links = nodash.arrayify(info.admit || info.allow || info.inflow);
      lodash.forEach(links, function(link) {
        if (lodash.isString(link) && !lodash.isEmpty(link)) {
          result.mappings[link] = label;
        }
      });
    });
  }
  if (!lodash.isEmpty(loglabelMappings)) {
    result.mappings = result.mappings || {};
    lodash.forOwn(loglabelMappings, function(sources, label) {
      sources = nodash.stringToArray(sources);
      lodash.forEach(sources, function(source) {
        if (lodash.isString(source) && !lodash.isEmpty(source)) {
          result.mappings[source] = label;
        }
      });
    });
  }
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
