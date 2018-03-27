'use strict';

var lodash = require('lodash');
var LogTracer = require('logolite').LogTracer;
var loader = require('../utils/loader');
var chores = require('../utils/chores');
var errorHandler = require('./error-handler').instance;

function BridgeLoader(params) {
  params = params || {};

  var blockRef = chores.getBlockRef(__filename);
  var loggingFactory = params.loggingFactory.branch(blockRef);
  var LX = loggingFactory.getLogger();
  var LT = loggingFactory.getTracer();
  var CTX = {LX, LT};

  var store = {};

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  LX.has('conlog') && LX.log('conlog', LT.add({
    bridgeRefs: params.bridgeRefs
  }).toMessage({
    text: ' + bridgeLoader start with bridgeRefs: ${bridgeRefs}'
  }));

  this.loadDialects = function(dialectMap, dialectOptions, optType) {
    dialectMap = dialectMap || {};
    var loaderCtx = {};
    lodash.defaultsDeep(dialectMap, buildBridgeDialects.call(loaderCtx, params.bridgeRefs, dialectOptions, optType));
    return dialectMap;
  };

  this.loadMetadata = function(metadataMap, dialectOptions) {
    metadataMap = metadataMap || {};
    var bridgeDescriptors = loadBridgeConstructors(params.bridgeRefs);
    lodash.defaultsDeep(metadataMap, lodash.mapValues(bridgeDescriptors, function(entrypoint) {
      var construktor = lodash.get(entrypoint, "construktor", {});
      return {
        name: entrypoint.name,
        metadata: construktor.devebotMetadata || construktor.metainf || construktor.metadata || null
      }
    }));
    return metadataMap;
  }

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

  const BRIDGE_NAME_PATTERNS = [
    /^devebot-co-([a-z][a-z0-9\-]*)$/g,
    /^([a-z][a-z0-9\-]*)$/g
  ];

  let extractBridgeCode = function(CTX, bridgeRef) {
    let info = chores.extractCodeByPattern(CTX, BRIDGE_NAME_PATTERNS, bridgeRef.name);
    if (info.i < 0) {
      errorHandler.collect(lodash.assign({
        stage: 'naming',
        type: 'bridge',
        hasError: true,
        stack: BRIDGE_NAME_PATTERNS.toString()
      }, bridgeRef));
    }
    return info.code;
  }

  var loadBridgeContructor = function(bridgeRef) {
    var self = this;

    bridgeRef = bridgeRef || {};

    var bridgeName = bridgeRef.name;
    var bridgePath = bridgeRef.path;

    LX.has('conlog') && LX.log('conlog', LT.add({
      bridgeName: bridgeName
    }).toMessage({
      text: ' - bridge constructor (${bridgeName}) loading is started'
    }));

    var result = {};

    var bridgeCode = extractBridgeCode(CTX, bridgeRef);
    if (typeof(bridgeCode) !== 'string') return result;

    var opStatus = lodash.assign({ type: 'DIALECT', code: bridgeCode }, bridgeRef);

    try {
      var bridgeConstructor = loader(bridgePath, { stopWhenError: true });
      LX.has('conlog') && LX.log('conlog', LT.add({
        bridgeName: bridgeName
      }).toMessage({
        text: ' - bridge constructor (${bridgeName}) loading has done.'
      }));
      if (lodash.isFunction(bridgeConstructor)) {
        result[bridgeCode] = {
          name: bridgeName,
          construktor: bridgeConstructor
        };
        opStatus.hasError = false;
      } else {
        LX.has('conlog') && LX.log('conlog', LT.add({
          bridgeName: bridgeName
        }).toMessage({
          text: ' - bridge "${bridgeName}" is not a constructor'
        }));
        opStatus.hasError = true;
      }
    } catch(err) {
      LX.has('conlog') && LX.log('conlog', LT.add({
        bridgeName: bridgeName
      }).toMessage({
        text: ' - bridge constructor (${bridgeName}) loading has failed'
      }));
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

    LX.has('conlog') && LX.log('conlog', LT.add({
      bridgeRefs: bridgeRefs
    }).toMessage({
      text: ' - load a list of bridge constructors: ${bridgeRefs}'
    }));

    var bridgeConstructors = {};
    bridgeRefs.forEach(function(bridgeRef) {
      lodash.assign(bridgeConstructors, loadBridgeContructor.call(self, bridgeRef));
    });

    LX.has('conlog') && LX.log('conlog', LT.add({
      bridgeConstructorNames: lodash.keys(bridgeConstructors)
    }).toMessage({
      text: ' - bridge constructors have been loaded: ${bridgeConstructorNames}'
    }));

    return bridgeConstructors;
  };

  var buildBridgeDialect = function(dialectOpts) {
    var self = this;
    var {pluginName, bridgeCode, bridgeRecord, dialectName, optType} = dialectOpts;
    var result = {};

    if (!lodash.isString(bridgeCode)) {
      LX.has('conlog') && LX.log('conlog', LT.toMessage({
        text: ' - bridgeCode is invalid (not a string)'
      }));
      return result;
    } else {
      LX.has('conlog') && LX.log('conlog', LT.add({
        dialectOptions: dialectOpts
      }).toMessage({
        text: ' - buildBridgeDialect() with parameters: ${dialectOptions}'
      }));
    }

    dialectName = dialectName || bridgeCode + 'Wrapper';
    LX.has('conlog') && LX.log('conlog', LT.add({
      dialectName: dialectName
    }).toMessage({
      text: ' - building bridgeDialect (${dialectName}) is started'
    }));

    var crateScope = pluginName;
    var crateName = [bridgeCode, dialectName].join('#');
    var sectorRef = [crateScope, crateName].join(chores.getSeparator());
    var uniqueName = [pluginName, bridgeRecord.name, dialectName].join(chores.getSeparator());
    if (!chores.isFeatureSupported('bridge-full-ref')) {
      crateScope = bridgeRecord.name;
      crateName = dialectName;
      sectorRef = [crateScope, crateName].join(chores.getSeparator());
      uniqueName = [bridgeRecord.name, dialectName].join(chores.getSeparator());
    }

    var bridgeConstructor = bridgeRecord.construktor;
    if (!lodash.isFunction(bridgeConstructor)) {
      LX.has('conlog') && LX.log('conlog', LT.toMessage({
        text: ' - bridgeConstructor is invalid (not a function)'
      }));
      return result;
    }

    var configPath;
    if (!chores.isFeatureSupported('bridge-full-ref')) {
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
    } else {
      configPath = ['sandboxConfig', 'bridges', bridgeCode, pluginName, dialectName];
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
        var loggingFactory = kwargs.loggingFactory.branch(sectorRef);
        this.logger = loggingFactory.getLogger();
        this.tracer = loggingFactory.getTracer();
      } else {
        this.logger = kwargs.loggingFactory.getLogger({ sector: sectorRef });
      }

      LX.has('silly') && LX.log('silly', LT.add({
        dialectName: dialectName,
        newFeatures: newFeatures
      }).toMessage({
        tags: [ sectorRef, 'apply-features' ],
        text: ' - newFeatures[${dialectName}]: ${newFeatures}'
      }));

      var opStatus = { stage: 'instantiating', type: 'DIALECT', name: dialectName, code: bridgeCode };
      try {
        if (newFeatures.logoliteEnabled) {
          LX.has('silly') && LX.log('silly', LT.toMessage({
            tags: [ sectorRef, 'constructor-begin' ],
            text: ' + constructor start ...'
          }));
        }

        bridgeConstructor.call(this, lodash.assign({
          tracking_code: kwargs.sandboxName
        }, lodash.get(kwargs, configPath, {})));

        if (newFeatures.logoliteEnabled) {
          LX.has('silly') && LX.log('silly', LT.toMessage({
            tags: [ sectorRef, 'constructor-end' ],
            text: ' - constructor has finished'
          }));
        }
      } catch(err) {
        LX.has('silly') && LX.log('silly', LT.add({
          bridgeCode: bridgeCode
        }).toMessage({
          tags: [ sectorRef, 'constructor-failed' ],
          text: ' - bridgeConstructor (${bridgeCode}) call has failed'
        }));
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
      crateScope: crateScope,
      name: crateName,
      construktor: dialectConstructor
    };

    LX.has('conlog') && LX.log('conlog', LT.add({
      dialectName: dialectName
    }).toMessage({
      text: ' - building bridgeDialect (${dialectName}) has done.'
    }));

    return result;
  };

  var buildBridgeDialects = function(bridgeRefs, dialectOptions, optType) {
    var self = this;

    optType = (lodash.isNumber(optType)) ? optType : 0;

    LX.has('silly') && LX.log('silly', LT.add({
      bridgeRefs: bridgeRefs
    }).toMessage({
      text: ' - bridgeDialects will be built: ${bridgeRefs}'
    }));

    var bridgeConstructors = loadBridgeConstructors.call(self, bridgeRefs);

    if (lodash.isEmpty(dialectOptions)) {
      LX.has('silly') && LX.log('silly', LT.add({
        options: dialectOptions
      }).toMessage({
        text: ' - dialectOptions is not provided, nothing is created'
      }));
    } else {
      LX.has('silly') && LX.log('silly', LT.add({
        options: dialectOptions
      }).toMessage({
        text: ' - dialectInstances will be built with options: ${options}'
      }));
    }

    var bridgeDialects = {};
    if (!chores.isFeatureSupported('bridge-full-ref')) {
      switch(optType) {
        case 0:
          lodash.forOwn(dialectOptions, function(dialectConfig, dialectName) {
            var bridgeCode = lodash.findKey(dialectConfig, function(o, k) {
              return lodash.isObject(o) && bridgeConstructors[k];
            });
            if (bridgeCode) {
              lodash.assign(bridgeDialects, buildBridgeDialect.call(self, {
                bridgeCode,
                bridgeRecord: bridgeConstructors[bridgeCode],
                dialectName,
                optType
              }));
            }
          });
          break;
        case 1:
          lodash.forOwn(dialectOptions, function(dialectMap, bridgeCode) {
            lodash.forOwn(dialectMap, function(dialectConfig, dialectName) {
              lodash.assign(bridgeDialects, buildBridgeDialect.call(self, {
                bridgeCode,
                bridgeRecord: bridgeConstructors[bridgeCode],
                dialectName,
                optType}));
            });
          });
          break;
        default:
          lodash.forOwn(dialectOptions, function(bridgeConfig, bridgeCode) {
            lodash.assign(bridgeDialects, buildBridgeDialect.call(self, {
              bridgeCode,
              bridgeRecord: bridgeConstructors[bridgeCode],
              dialectName: bridgeCode + 'Wrapper',
              optType
            }));
          });
      }
    } else {
      lodash.forOwn(dialectOptions, function(bridgeMap, bridgeCode) {
        if (!bridgeCode || !bridgeConstructors[bridgeCode]) return;
        lodash.forOwn(bridgeMap, function(pluginMap, pluginName) {
          lodash.forOwn(pluginMap, function(dialectConfig, dialectName) {
            lodash.assign(bridgeDialects, buildBridgeDialect.call(self, {
              pluginName,
              bridgeCode,
              bridgeRecord: bridgeConstructors[bridgeCode],
              dialectName,
              optType
            }));
          });
        });
      });
    }

    LX.has('silly') && LX.log('silly', LT.add({
      bridgeDialectNames: lodash.keys(bridgeDialects)
    }).toMessage({
      text: ' - bridgeDialects have been built: ${bridgeDialectNames}'
    }));

    return bridgeDialects;
  };

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ private members

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
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
 