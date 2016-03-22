'use strict';

var lodash = require('lodash');

var loader = require('../utils/loader.js');
var debuglog = require('../utils/debug.js')('devebot:bridgeLoader');

function bridgeLoader(bridgeNames, wrapperOptions) {
  if (debuglog.isEnabled) {
    debuglog(' + bridgeLoader start with params: %s', JSON.stringify(bridgeNames));
  }

  return buildBridgeWrappers(bridgeNames, wrapperOptions);

  if (debuglog.isEnabled) {
    debuglog(' + load the list of bridges: %s', JSON.stringify(bridgeNames));
  }
  
  if (!lodash.isArray(bridgeNames)) bridgeNames = [];  

  var bridgeServices = {};
  bridgeNames.forEach(function(bridgeName) {
    lodash.assign(bridgeServices, extendBridgeConstructor(bridgeName));
  });

  if (debuglog.isEnabled) {
    debuglog(' - wrapping bridge services: %s', JSON.stringify(lodash.keys(bridgeServices)));
  }
  
  return bridgeServices;
}

var extendBridgeConstructor = function(bridgeName) {
  if (debuglog.isEnabled) {
    debuglog(' - wrapping bridge service (%s) is started', bridgeName);
  }

  var result = {};

  bridgeName = bridgeName || '';

  var regexName = /^devebot-co-([a-z][a-z0-9\-]*)$/g;

  if (!bridgeName.match(regexName)) {
    debuglog(' - bridgeName "%s" is invalid', bridgeName);
    return result;
  }

  var shortName = bridgeName.replace(regexName, '\$1')
    .replace(/-([a-z])/g, function (m, w) { return w.toUpperCase(); })
    .replace(/-([0-9])/g, function (m, w) { return '_' + w; });

  var wrapperName = shortName + 'Wrapper';

  var bridgeConstructor = loader(bridgeName);

  function wrapperConstructor(params) {
    params = params || {};

    var self = this;

    var loggingFactory = params.loggingFactory;
    self.logger = loggingFactory.getLogger();

    self.getSandboxName = function() {
      return params.sandboxname;
    };

    bridgeConstructor.call(self, lodash.assign({
      tracking_code: params.sandboxname
    }, lodash.get(params, ['sandboxconfig', 'bridges', shortName], {})));
  }

  wrapperConstructor.prototype = Object.create(bridgeConstructor.prototype);

  wrapperConstructor.argumentSchema = {
    "id": "/" + wrapperName,
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
    debuglog(' - wrapping bridge service (%s) creation has done.', bridgeName);
  }

  return result;
};

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
  if (!lodash.isArray(bridgeNames)) {
    bridgeNames = [];
  }

  if (debuglog.isEnabled) {
    debuglog(' - load a list of bridges: %s', JSON.stringify(bridgeNames));
  }

  var bridgeConstructors = {};
  bridgeNames.forEach(function(bridgeName) {
    lodash.assign(bridgeConstructors, loadBridgeContructor(bridgeName));
  });

  if (debuglog.isEnabled) {
    debuglog(' - bridge constructors: %s', JSON.stringify(lodash.keys(bridgeConstructors)));
  }

  return bridgeConstructors;
};

var buildBridgeWrapper = function(bridgeCode, bridgeConstructor, wrapperName) {
  var result = {};

  if (!lodash.isString(bridgeCode)) {
    debuglog(' - bridgeCode is invalid');
    return result;
  }

  if (!lodash.isFunction(bridgeConstructor)) {
    debuglog(' - bridgeConstructor is invalid');
    return result;
  }

  var wrapperName = wrapperName || bridgeCode + 'Wrapper';

  if (debuglog.isEnabled) {
    debuglog(' - build bridge wrapper (%s) is started', wrapperName);
  }

  function wrapperConstructor(params) {
    params = params || {};

    var self = this;

    var loggingFactory = params.loggingFactory;
    self.logger = loggingFactory.getLogger();

    self.getSandboxName = function() {
      return params.sandboxname;
    };

    bridgeConstructor.call(self, lodash.assign({
      tracking_code: params.sandboxname
    }, lodash.get(params, ['sandboxconfig', 'bridges', wrapperName, bridgeCode], {})));
  }

  wrapperConstructor.prototype = Object.create(bridgeConstructor.prototype);

  wrapperConstructor.argumentSchema = {
    "id": "/" + wrapperName,
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

var buildBridgeWrappers = function(bridgeNames, wrapperOptions) {
  var bridgeConstructors = loadBridgeConstructors(bridgeNames);

  var bridgeWrappers = {};
  lodash.forOwn(wrapperOptions, function(wrapperConfig, wrapperName) {
    var keys = lodash.keys(wrapperConfig);
    var bridgeCode = (keys.length > 0) keys[0] : null;
    lodash.assign(bridgeWrappers, buildBridgeWrapper(bridgeCode, 
        bridgeConstructors[bridgeCode], wrapperName));
  });
  return bridgeWrappers;
};

module.exports = bridgeLoader;
