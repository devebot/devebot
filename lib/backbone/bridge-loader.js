'use strict';

var lodash = require('lodash');
var LogTracer = require('logolite').LogTracer;
var loader = require('../utils/loader.js');
var chores = require('../utils/chores.js');
var debugx = require('../utils/debug.js')('devebot:bridgeLoader');

function BridgeLoader(params) {
  debugx.enabled && debugx(' + constructor start ...');

  params = params || {};

  debugx.enabled && debugx(' + bridgeLoader start with bridgeRefs: %s', JSON.stringify(params.bridgeRefs));

  this.loadWrappers = function(wrapperMap, wrapperOptions) {
    wrapperMap = wrapperMap || {};
    var loaderCtx = { processMonitor: params.processMonitor };
    lodash.defaultsDeep(wrapperMap, buildBridgeWrappers.call(loaderCtx, params.bridgeRefs, wrapperOptions));
    return wrapperMap;
  };

  debugx.enabled && debugx(' - constructor has finished');
}

BridgeLoader.argumentSchema = {
  "id": "bridgeLoader",
  "type": "object",
  "properties": {
    "processMonitor": {
      "type": "object"
    },
    "bridgeRefs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "path": {
            "type": "string"
          }
        }
      }
    }
  }
};

module.exports = BridgeLoader;

var bridgeNamePatterns = [
  /^devebot-co-([a-z][a-z0-9\-]*)$/g,
  /^([a-z][a-z0-9\-]*)$/g
];

var extractBridgeCode = function(bridgeName) {
  var info = {};
  for(info.i=0; info.i<bridgeNamePatterns.length; info.i++) {
    if (bridgeName.match(bridgeNamePatterns[info.i])) break;
  }
  if (info.i >= bridgeNamePatterns.length) {
    debugx.enabled && debugx(' - bridge with name "%s" is invalid', bridgeName);
    return info;
  }
  info.code = bridgeName.replace(bridgeNamePatterns[info.i], '\$1')
    .replace(/-([a-z])/g, function (m, w) { return w.toUpperCase(); })
    .replace(/-([0-9])/g, function (m, w) { return '_' + w; });
  debugx.enabled && debugx(' - extracted code "%s"', JSON.stringify(info));
  return info;
}

var loadBridgeContructor = function(bridgeRef) {
  var self = this;

  bridgeRef = bridgeRef || {};

  var bridgeName = bridgeRef.name;
  var bridgePath = bridgeRef.path;

  debugx.enabled && debugx(' - bridge constructor (%s) loading is started', bridgeName);

  var result = {};

  var bridgeCode = extractBridgeCode(bridgeName).code;
  if (typeof(bridgeCode) !== 'string') return result;

  var opStatus = lodash.assign({ type: 'WRAPPER', code: bridgeCode }, bridgeRef);

  try {
    var bridgeConstructor = loader(bridgePath, { stopWhenError: true });
    debugx.enabled && debugx(' - bridge constructor (%s) loading has done.', bridgeName);
    if (lodash.isFunction(bridgeConstructor)) {
      result[bridgeCode] = {
        bridgeId: bridgeName,
        construktor: bridgeConstructor
      };
      opStatus.hasError = false;
    } else {
      debugx.enabled && debugx(' - bridge "%s" is not a constructor', bridgeName);
      opStatus.hasError = true;
    }
  } catch(err) {
    debugx.enabled && debugx(' - bridge constructor (%s) loading has failed', bridgeName);
    opStatus.hasError = true;
    opStatus.stack = err.stack;
  }

  self.processMonitor.collect(opStatus);

  return result;
};

var loadBridgeConstructors = function(bridgeRefs) {
  var self = this;

  bridgeRefs = lodash.isArray(bridgeRefs) ? bridgeRefs : [];

  bridgeRefs = lodash.filter(bridgeRefs, function(bridgeRef) {
    return lodash.isString(bridgeRef.name) && lodash.isString(bridgeRef.path);
  });

  debugx.enabled && debugx(' - load a list of bridge constructors: %s', JSON.stringify(bridgeRefs));

  var bridgeConstructors = {};
  bridgeRefs.forEach(function(bridgeRef) {
    lodash.assign(bridgeConstructors, loadBridgeContructor.call(self, bridgeRef));
  });

  debugx.enabled && debugx(' - bridge constructors have been loaded: %s', JSON.stringify(lodash.keys(bridgeConstructors)));

  return bridgeConstructors;
};

var buildBridgeWrapper = function(bridgeCode, bridgeRecord, wrapperName, optType) {
  var self = this;

  var result = {};

  if (!lodash.isString(bridgeCode)) {
    debugx.enabled && debugx(' - bridgeCode is invalid');
    return result;
  }

  var bridgeConstructor = bridgeRecord.construktor;
  if (!lodash.isFunction(bridgeConstructor)) {
    debugx.enabled && debugx(' - bridgeConstructor is invalid');
    return result;
  }

  wrapperName = wrapperName || bridgeCode + 'Wrapper';

  debugx.enabled && debugx(' - build bridge wrapper (%s) is started', wrapperName);

  var configPath;
  switch(optType) {
    case 0:
      configPath = ['sandboxConfig', 'bridges', wrapperName, bridgeCode];
      break;
    case 1:
      configPath = ['sandboxConfig', 'bridges', bridgeCode, wrapperName];
      break;
    default:
      configPath = ['sandboxConfig', 'bridges', bridgeCode];
  }

  function wrapperConstructor(params) {
    params = params || {};

    var isWrapped = false;
    var getWrappedParams = function() {
      if (isWrapped) return params;
      isWrapped = true;
      return params = lodash.clone(params);
    }

    var newFeatures = lodash.get(params, ['profileConfig', 'newFeatures', wrapperName], null);
    if (newFeatures === null) {
      newFeatures = lodash.get(params, ['profileConfig', 'newFeatures', bridgeCode], {});
    }
    debugx.enabled && debugx(' - newFeatures[%s]: %s', wrapperName, JSON.stringify(newFeatures));

    if (newFeatures.logoliteEnabled) {
      this.logger = params.loggingFactory.getWrappedLogger();
      this.tracer = LogTracer.ROOT
        .branch({ key: 'serviceName', value: wrapperName })
        .branch({ key: 'serviceId', value: LogTracer.getLogID() });
      this.logger.isEnabledFor('info') && this.logger.log('info', this.tracer.add({
        message: 'create new bridge service',
        bridgeName: bridgeCode
      }).toMessage({reset: true}));
    } else {
      this.logger = params.loggingFactory.getLogger();
    }

    this.getSandboxName = function() {
      return params.sandboxName;
    };

    var opStatus = { stage: 'instantiating', type: 'WRAPPER', name: wrapperName, code: bridgeCode };
    try {
      bridgeConstructor.call(this, lodash.assign({
        tracking_code: params.sandboxName
      }, lodash.get(params, configPath, {})));
    } catch(err) {
      debugx.enabled && debugx(' - bridgeConstructor (%s) call has failed', bridgeCode);
      opStatus.hasError = true;
      opStatus.stack = err.stack;
    }
    self.processMonitor.collect(opStatus);
  }

  wrapperConstructor.prototype = Object.create(bridgeConstructor.prototype);

  wrapperConstructor.argumentSchema = {
    "id": wrapperName,
    "type": "object",
    "properties": {
      "sandboxName": {
        "type": "string"
      },
      "sandboxConfig": {
        "type": "object"
      },
      "profileConfig": {
        "type": "object"
      },
      "loggingFactory": {
        "type": "object"
      }
    }
  };

  result[[bridgeRecord.bridgeId, wrapperName].join(chores.getSeparator())] = {
    bridgeId: bridgeRecord.bridgeId,
    name: wrapperName,
    construktor: wrapperConstructor
  };

  debugx.enabled && debugx(' - build bridge wrapper (%s) has done.', wrapperName);

  return result;
};

var buildBridgeWrappers = function(bridgeRefs, wrapperOptions, optType) {
  var self = this;

  optType = (lodash.isNumber(optType)) ? optType : 0;

  debugx.enabled && debugx(' - bridgeWrappers will be built: %s', JSON.stringify(bridgeRefs));

  var bridgeConstructors = loadBridgeConstructors.call(self, bridgeRefs);

  var bridgeWrappers = {};
  switch(optType) {
    case 0:
      lodash.forOwn(wrapperOptions, function(wrapperConfig, wrapperName) {
        var bridgeCode = lodash.findKey(wrapperConfig, function(o, k) {
          return lodash.isObject(o) && bridgeConstructors[k];
        });
        if (bridgeCode) {
          lodash.assign(bridgeWrappers, buildBridgeWrapper.call(self, bridgeCode,
              bridgeConstructors[bridgeCode], wrapperName, optType));
        }
      });
      break;
    case 1:
      lodash.forOwn(wrapperOptions, function(wrapperMap, bridgeCode) {
        lodash.forOwn(wrapperMap, function(wrapperConfig, wrapperName) {
          lodash.assign(bridgeWrappers, buildBridgeWrapper.call(self, bridgeCode,
              bridgeConstructors[bridgeCode], wrapperName, optType));
        });
      });
      break;
    default:
      lodash.forOwn(wrapperOptions, function(bridgeConfig, bridgeCode) {
        lodash.assign(bridgeWrappers, buildBridgeWrapper.call(self, bridgeCode,
            bridgeConstructors[bridgeCode], bridgeCode + 'Wrapper', optType));
      });
  }

  debugx.enabled && debugx(' - bridgeWrappers have been built: %s', JSON.stringify(lodash.keys(bridgeWrappers)));

  return bridgeWrappers;
};
