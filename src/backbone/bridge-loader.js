'use strict';

var lodash = require('lodash');
var LogTracer = require('logolite').LogTracer;
var loader = require('../utils/loader.js');
var chores = require('../utils/chores.js');
var errorHandler = require('./error-handler').instance;

function BridgeLoader(params) {
  params = params || {};

  var loggingFactory = params.loggingFactory.branch(chores.getBlockRef(__filename));
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  LX.has('conlog') && LX.log('conlog', ' + bridgeLoader start with bridgeRefs: %s', JSON.stringify(params.bridgeRefs));

  this.loadDialects = function(dialectMap, dialectOptions, optType) {
    dialectMap = dialectMap || {};
    var loaderCtx = {};
    lodash.defaultsDeep(dialectMap, buildBridgeDialects.call(loaderCtx, params.bridgeRefs, dialectOptions, optType));
    return dialectMap;
  };

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

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
      LX.has('conlog') && LX.log('conlog', ' - bridge with name "%s" is invalid', bridgeName);
      return info;
    }
    info.code = bridgeName.replace(bridgeNamePatterns[info.i], '\$1')
      .replace(/-([a-z])/g, function (m, w) { return w.toUpperCase(); })
      .replace(/-([0-9])/g, function (m, w) { return '_' + w; });
    LX.has('conlog') && LX.log('conlog', ' - extracted code "%s"', JSON.stringify(info));
    return info;
  }

  var loadBridgeContructor = function(bridgeRef) {
    var self = this;

    bridgeRef = bridgeRef || {};

    var bridgeName = bridgeRef.name;
    var bridgePath = bridgeRef.path;

    LX.has('conlog') && LX.log('conlog', ' - bridge constructor (%s) loading is started', bridgeName);

    var result = {};

    var bridgeCode = extractBridgeCode(bridgeName).code;
    if (typeof(bridgeCode) !== 'string') return result;

    var opStatus = lodash.assign({ type: 'DIALECT', code: bridgeCode }, bridgeRef);

    try {
      var bridgeConstructor = loader(bridgePath, { stopWhenError: true });
      LX.has('conlog') && LX.log('conlog', ' - bridge constructor (%s) loading has done.', bridgeName);
      if (lodash.isFunction(bridgeConstructor)) {
        result[bridgeCode] = {
          moduleId: bridgeName,
          construktor: bridgeConstructor
        };
        opStatus.hasError = false;
      } else {
        LX.has('conlog') && LX.log('conlog', ' - bridge "%s" is not a constructor', bridgeName);
        opStatus.hasError = true;
      }
    } catch(err) {
      LX.has('conlog') && LX.log('conlog', ' - bridge constructor (%s) loading has failed', bridgeName);
      opStatus.hasError = true;
      opStatus.stack = err.stack;
    }

    errorHandler.collect(opStatus);

    return result;
  };

  var loadBridgeConstructors = function(bridgeRefs) {
    var self = this;

    bridgeRefs = lodash.isArray(bridgeRefs) ? bridgeRefs : [];

    bridgeRefs = lodash.filter(bridgeRefs, function(bridgeRef) {
      return lodash.isString(bridgeRef.name) && lodash.isString(bridgeRef.path);
    });

    LX.has('conlog') && LX.log('conlog', ' - load a list of bridge constructors: %s', JSON.stringify(bridgeRefs));

    var bridgeConstructors = {};
    bridgeRefs.forEach(function(bridgeRef) {
      lodash.assign(bridgeConstructors, loadBridgeContructor.call(self, bridgeRef));
    });

    LX.has('conlog') && LX.log('conlog', ' - bridge constructors have been loaded: %s', JSON.stringify(lodash.keys(bridgeConstructors)));

    return bridgeConstructors;
  };

  var buildBridgeDialect = function(bridgeCode, bridgeRecord, dialectName, optType) {
    var self = this;

    var result = {};

    if (!lodash.isString(bridgeCode)) {
      LX.has('conlog') && LX.log('conlog', ' - bridgeCode is invalid');
      return result;
    }

    var uniqueName = [bridgeRecord.moduleId, dialectName].join(chores.getSeparator());

    var bridgeConstructor = bridgeRecord.construktor;
    if (!lodash.isFunction(bridgeConstructor)) {
      LX.has('conlog') && LX.log('conlog', ' - bridgeConstructor is invalid');
      return result;
    }

    dialectName = dialectName || bridgeCode + 'Wrapper';

    LX.has('conlog') && LX.log('conlog', ' - build bridgeDialect (%s) is started', dialectName);

    var configPath;
    switch(optType) {
      case 0:
        configPath = ['sandboxConfig', 'bridges', dialectName, bridgeCode];
        break;
      case 1:
        configPath = ['sandboxConfig', 'bridges', bridgeCode, dialectName];
        break;
      default:
        configPath = ['sandboxConfig', 'bridges', bridgeCode];
    }

    function dialectConstructor(kwargs) {
      kwargs = kwargs || {};

      var isWrapped = false;
      var getWrappedParams = function() {
        if (isWrapped) return kwargs;
        isWrapped = true;
        return kwargs = lodash.clone(kwargs);
      }

      var newFeatures = lodash.get(kwargs, ['profileConfig', 'newFeatures', dialectName], null);
      if (newFeatures === null) {
        newFeatures = lodash.get(kwargs, ['profileConfig', 'newFeatures', bridgeCode], {});
      }

      if (newFeatures.logoliteEnabled) {
        var loggingFactory = kwargs.loggingFactory.branch(uniqueName);
        this.logger = loggingFactory.getLogger();
        this.tracer = loggingFactory.getTracer();
      } else {
        this.logger = kwargs.loggingFactory.getLogger({ sector: uniqueName });
      }

      this.logger.has('conlog') && this.logger.log('conlog',
        ' - newFeatures[%s]: %s', dialectName, JSON.stringify(newFeatures));

      var opStatus = { stage: 'instantiating', type: 'DIALECT', name: dialectName, code: bridgeCode };
      try {
        if (newFeatures.logoliteEnabled) {
          this.logger.has('conlog') && this.logger.log('conlog', this.tracer.toMessage({
            tags: [ 'constructor-begin' ],
            text: ' + constructor start ...'
          }));
        }

        bridgeConstructor.call(this, lodash.assign({
          tracking_code: kwargs.sandboxName
        }, lodash.get(kwargs, configPath, {})));

        if (newFeatures.logoliteEnabled) {
          this.logger.has('conlog') && this.logger.log('conlog', this.tracer.toMessage({
            tags: [ 'constructor-end' ],
            text: ' - constructor has finished'
          }));
        }
      } catch(err) {
        this.logger.has('conlog') && this.logger.log('conlog',
          ' - bridgeConstructor (%s) call has failed', bridgeCode);
        opStatus.hasError = true;
        opStatus.stack = err.stack;
      }
      errorHandler.collect(opStatus);
    }

    dialectConstructor.prototype = Object.create(bridgeConstructor.prototype);

    dialectConstructor.argumentSchema = {
      "$id": dialectName,
      "type": "object",
      "properties": {
        "sandboxName": {
          "type": "string"
        },
        "sandboxConfig": {
          "type": "object"
        },
        "profileName": {
          "type": "string"
        },
        "profileConfig": {
          "type": "object"
        },
        "loggingFactory": {
          "type": "object"
        }
      }
    };

    result[uniqueName] = {
      moduleId: bridgeRecord.moduleId,
      name: dialectName,
      construktor: dialectConstructor
    };

    LX.has('conlog') && LX.log('conlog', ' - build bridgeDialect (%s) has done.', dialectName);

    return result;
  };

  var buildBridgeDialects = function(bridgeRefs, dialectOptions, optType) {
    var self = this;

    optType = (lodash.isNumber(optType)) ? optType : 0;

    LX.has('conlog') && LX.log('conlog', ' - bridgeDialects will be built: %s', JSON.stringify(bridgeRefs));

    var bridgeConstructors = loadBridgeConstructors.call(self, bridgeRefs);

    if (lodash.isEmpty(dialectOptions)) {
      LX.has('conlog') && LX.log('conlog', LT.add({
        options: dialectOptions
      }).toMessage({
        text: ' - dialectOptions is not provided, nothing is created'
      }));
    } else {
      LX.has('conlog') && LX.log('conlog', LT.add({
        options: dialectOptions
      }).toMessage({
        text: ' - dialectInstances will be built with options: ${options}'
      }));
    }

    var bridgeDialects = {};
    switch(optType) {
      case 0:
        lodash.forOwn(dialectOptions, function(dialectConfig, dialectName) {
          var bridgeCode = lodash.findKey(dialectConfig, function(o, k) {
            return lodash.isObject(o) && bridgeConstructors[k];
          });
          if (bridgeCode) {
            lodash.assign(bridgeDialects, buildBridgeDialect.call(self, bridgeCode,
                bridgeConstructors[bridgeCode], dialectName, optType));
          }
        });
        break;
      case 1:
        lodash.forOwn(dialectOptions, function(dialectMap, bridgeCode) {
          lodash.forOwn(dialectMap, function(dialectConfig, dialectName) {
            lodash.assign(bridgeDialects, buildBridgeDialect.call(self, bridgeCode,
                bridgeConstructors[bridgeCode], dialectName, optType));
          });
        });
        break;
      default:
        lodash.forOwn(dialectOptions, function(bridgeConfig, bridgeCode) {
          lodash.assign(bridgeDialects, buildBridgeDialect.call(self, bridgeCode,
              bridgeConstructors[bridgeCode], bridgeCode + 'Wrapper', optType));
        });
    }

    LX.has('conlog') && LX.log('conlog', ' - bridgeDialects have been built: %s', JSON.stringify(lodash.keys(bridgeDialects)));

    return bridgeDialects;
  };

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

BridgeLoader.argumentSchema = {
  "$id": "bridgeLoader",
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
    },
    "loggingFactory": {
      "type": "object"
    }
  }
};

module.exports = BridgeLoader;
 