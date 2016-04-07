'use strict';

var events = require('events');
var util = require('util');
var lodash = require('lodash');

var loader = require('../utils/loader.js');
var debug = require('../utils/debug.js');
var debuglog = debug('devebot:bridgeLoader');

function BridgeLoader(params) {
  debuglog(' + constructor start ...');
  BridgeLoader.super_.apply(this);

  params = params || {};

  if (debuglog.isEnabled) {
    debuglog(' + bridgeLoader start with bridgeRefs: %s', JSON.stringify(params.bridgeRefs));
  }

  this.loadWrappers = function(wrapperMap, wrapperOptions) {
    wrapperMap = wrapperMap || {};
    lodash.defaultsDeep(wrapperMap, buildBridgeWrappers(params.bridgeRefs, wrapperOptions));
    return wrapperMap;
  };

  debuglog(' - constructor has finished');
}

BridgeLoader.argumentSchema = {
  "id": "bridgeLoader",
  "type": "object",
  "properties": {
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

util.inherits(BridgeLoader, events.EventEmitter);

module.exports = BridgeLoader;

var bridgeNamePattern = /^devebot-co-([a-z][a-z0-9\-]*)$/g;

var loadBridgeContructor = function(bridgeRef) {
  bridgeRef = bridgeRef || {};

  var bridgeName = bridgeRef.name;
  var bridgePath = bridgeRef.path;

  if (debuglog.isEnabled) {
    debuglog(' - bridge constructor (%s) loading is started', bridgeName);
  }

  var result = {};

  if (!bridgeName.match(bridgeNamePattern)) {
    debuglog(' - bridge with name "%s" is invalid', bridgeName);
    return result;
  }

  var bridgeCode = bridgeName.replace(bridgeNamePattern, '\$1')
    .replace(/-([a-z])/g, function (m, w) { return w.toUpperCase(); })
    .replace(/-([0-9])/g, function (m, w) { return '_' + w; });

  var bridgeConstructor = loader(bridgePath);

  if (!lodash.isFunction(bridgeConstructor)) {
    debuglog(' - bridge "%s" is not a constructor');
    return result;
  }

  result[bridgeCode] = bridgeConstructor;

  if (debuglog.isEnabled) {
    debuglog(' - bridge constructor (%s) loading has done.', bridgeName);
  }

  return result;
};

var loadBridgeConstructors = function(bridgeRefs) {
  bridgeRefs = lodash.isArray(bridgeRefs) ? bridgeRefs : [];

  bridgeRefs = lodash.filter(bridgeRefs, function(bridgeRef) {
    return lodash.isString(bridgeRef.name) && lodash.isString(bridgeRef.path);
  });
  
  if (debuglog.isEnabled) {
    debuglog(' - load a list of bridgeConstructors: %s', JSON.stringify(bridgeRefs));
  }

  var bridgeConstructors = {};
  bridgeRefs.forEach(function(bridgeRef) {
    lodash.assign(bridgeConstructors, loadBridgeContructor(bridgeRef));
  });

  if (debuglog.isEnabled) {
    debuglog(' - bridge constructors have been loaded: %s', JSON.stringify(lodash.keys(bridgeConstructors)));
  }

  return bridgeConstructors;
};

var buildBridgeWrapper = function(bridgeCode, bridgeConstructor, wrapperName, optType) {
  var result = {};

  if (!lodash.isString(bridgeCode)) {
    debuglog(' - bridgeCode is invalid');
    return result;
  }

  if (!lodash.isFunction(bridgeConstructor)) {
    debuglog(' - bridgeConstructor is invalid');
    return result;
  }

  wrapperName = wrapperName || bridgeCode + 'Wrapper';

  if (debuglog.isEnabled) {
    debuglog(' - build bridge wrapper (%s) is started', wrapperName);
  }

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

    var self = this;

    self.logger = params.loggingFactory.getLogger();

    self.getSandboxName = function() {
      return params.sandboxName;
    };

    bridgeConstructor.call(self, lodash.assign({
      tracking_code: params.sandboxName
    }, lodash.get(params, configPath, {})));
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
      "loggingFactory": {
        "type": "object"
      }
    }
  };

  result[wrapperName] = wrapperConstructor;

  if (debuglog.isEnabled) {
    debuglog(' - build bridge wrapper (%s) has done.', wrapperName);
  }

  return result;
};

var buildBridgeWrappers = function(bridgeRefs, wrapperOptions, optType) {
  optType = (lodash.isNumber(optType)) ? optType : 0;
  
  if (debuglog.isEnabled) {
    debuglog(' - bridgeWrappers will be built: %s', JSON.stringify(bridgeRefs));
  }
  
  var bridgeConstructors = loadBridgeConstructors(bridgeRefs);
  
  var bridgeWrappers = {};
  switch(optType) {
    case 0:
      lodash.forOwn(wrapperOptions, function(wrapperConfig, wrapperName) {
        var bridgeCode = lodash.findKey(wrapperConfig, function(o, k) {
          return lodash.isObject(o) && bridgeConstructors[k];
        });
        if (bridgeCode) {
          lodash.assign(bridgeWrappers, buildBridgeWrapper(bridgeCode, 
              bridgeConstructors[bridgeCode], wrapperName, optType));
        }
      });
      break;
    case 1:
      lodash.forOwn(wrapperOptions, function(wrapperMap, bridgeCode) {
        lodash.forOwn(wrapperMap, function(wrapperConfig, wrapperName) {
          lodash.assign(bridgeWrappers, buildBridgeWrapper(bridgeCode, 
              bridgeConstructors[bridgeCode], wrapperName, optType));  
        });
      });
      break;
    default:
      lodash.forOwn(wrapperOptions, function(bridgeConfig, bridgeCode) {
        lodash.assign(bridgeWrappers, buildBridgeWrapper(bridgeCode, 
            bridgeConstructors[bridgeCode], bridgeCode + 'Wrapper', optType));
      });  
  }
  
  if (debuglog.isEnabled) {
    debuglog(' - bridgeWrappers have been built: %s', JSON.stringify(lodash.keys(bridgeWrappers)));
  }
  
  return bridgeWrappers;
};
