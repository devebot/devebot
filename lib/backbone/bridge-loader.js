'use strict';

var lodash = require('lodash');

var loader = require('../utils/loader.js');
var debuglog = require('../utils/debug.js')('devebot:bridgeLoader');

function bridgeLoader(bridgeNames) {
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

    bridgeConstructor.apply(this, lodash.get(params, ['sandboxconfig', shortName], {}));
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

module.exports = bridgeLoader;
