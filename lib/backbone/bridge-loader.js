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
    debuglog(' + bridgeLoader start with bridgeNames: %s', JSON.stringify(params.bridgeNames));
  }

  this.loadWrappers = function(wrapperMap, wrapperOptions) {
    wrapperMap = wrapperMap || {};
    lodash.defaultsDeep(wrapperMap, buildBridgeWrappers(params.bridgeNames, wrapperOptions));
    return wrapperMap;
  };

  debuglog(' - constructor has finished');
}

BridgeLoader.argumentSchema = {
  "id": "bridgeLoader",
  "type": "object",
  "properties": {
    "bridgeNames": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
};

util.inherits(BridgeLoader, events.EventEmitter);

module.exports = BridgeLoader;

var bridgeNamePattern = /^devebot-co-([a-z][a-z0-9\-]*)$/g;

var loadBridgeContructor = function(bridgeName) {
  bridgeName = bridgeName || '';

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

  var bridgeConstructor = loader(bridgeName);

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

var loadBridgeConstructors = function(bridgeNames) {
  bridgeNames = lodash.isArray(bridgeNames) ? bridgeNames : [];

  bridgeNames = lodash.filter(bridgeNames, function(bridgeName) {
    return lodash.isString(bridgeName);
  });
  
  if (debuglog.isEnabled) {
    debuglog(' - load a list of bridgeConstructors: %s', JSON.stringify(bridgeNames));
  }

  var bridgeConstructors = {};
  bridgeNames.forEach(function(bridgeName) {
    lodash.assign(bridgeConstructors, loadBridgeContructor(bridgeName));
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
      configPath = ['sandboxconfig', 'bridges', wrapperName, bridgeCode];
      break;
    case 1:
      configPath = ['sandboxconfig', 'bridges', bridgeCode, wrapperName];
      break;
    default:
      configPath = ['sandboxconfig', 'bridges', bridgeCode];
  }
  
  function wrapperConstructor(params) {
    params = params || {};

    var self = this;

    self.logger = params.loggingFactory.getLogger();

    self.getSandboxName = function() {
      return params.sandboxname;
    };

    bridgeConstructor.call(self, lodash.assign({
      tracking_code: params.sandboxname
    }, lodash.get(params, configPath, {})));
  }

  wrapperConstructor.prototype = Object.create(bridgeConstructor.prototype);

  wrapperConstructor.argumentSchema = {
    "id": wrapperName,
    "type": "object",
    "properties": {
      "sandboxname": {
        "type": "string"
      },
      "sandboxconfig": {
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

var buildBridgeWrappers = function(bridgeNames, wrapperOptions, optType) {
  optType = (lodash.isNumber(optType)) ? optType : 0;
  
  if (debuglog.isEnabled) {
    debuglog(' - bridgeWrappers will be built: %s', JSON.stringify(bridgeNames));
  }
  
  var bridgeConstructors = loadBridgeConstructors(bridgeNames);
  
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
