'use strict';

const assert = require('assert');
const Promise = require('bluebird');
const lodash = require('lodash');
const chores = require('../utils/chores');
const nodash = require('../utils/nodash');
const errors = require('../utils/errors');
const getenv = require('../utils/getenv');
const BeanProxy = require('../utils/proxy');
const blockRef = chores.getBlockRef(__filename);

const NOOP = function() {}
const MODE = getenv(['DEVEBOT_NODE_ENV', 'NODE_ENV']) === 'test' ? null : 'direct';

function ObjectDecorator(params = {}) {
  const loggingFactory = params.loggingFactory.branch(blockRef);
  const nameResolver = params.nameResolver;
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const C = lodash.assign({L, T}, lodash.pick(params, ['issueInspector', 'schemaValidator']));
  const decoratorCfg = lodash.get(params, ['profileConfig', 'decorator'], {});
  const textureStore = lodash.get(params, ['textureConfig']);
  const instanceId = T.get('instanceId');
  const streamId = extractStreamId(decoratorCfg.logging, params.appInfo, instanceId);

  this.wrapBridgeDialect = function(beanConstructor, opts) {
    if (!chores.isUpgradeSupported('bean-decorator')) {
      return beanConstructor;
    }
    const textureOfBean = getTextureOfBridge({
      textureStore: textureStore,
      pluginCode: opts.pluginCode || nameResolver.getDefaultAliasOf(opts.pluginName, 'plugin'),
      bridgeCode: opts.bridgeCode || nameResolver.getDefaultAliasOf(opts.bridgeName, 'bridge'),
      dialectName: opts.dialectName
    });
    const fullObjectName = getBridgeFullname({
      pluginName: opts.pluginName || nameResolver.getOriginalNameOf(opts.pluginCode, 'plugin'),
      bridgeCode: opts.bridgeCode || nameResolver.getDefaultAliasOf(opts.bridgeName, 'bridge'),
      dialectName: opts.dialectName
    });
    return wrapConstructor(C, beanConstructor, lodash.assign({
      textureOfBean, objectName: fullObjectName, streamId
    }, lodash.pick(opts, ['logger', 'tracer', 'supportAllMethods', 'useDefaultTexture'])));
  }

  this.wrapPluginGadget = function(beanConstructor, opts) {
    if (!chores.isUpgradeSupported('bean-decorator')) {
      return beanConstructor;
    }
    const textureOfBean = getTextureOfPlugin({
      textureStore: textureStore,
      pluginCode: opts.pluginCode || nameResolver.getDefaultAliasOf(opts.pluginName, 'plugin'),
      gadgetType: opts.gadgetType,
      gadgetName: opts.gadgetName
    });
    const fullObjectName = getPluginFullname({
      pluginName: opts.pluginName || nameResolver.getOriginalNameOf(opts.pluginCode, 'plugin'),
      gadgetName: opts.gadgetName
    });
    const supportAllMethods = determineOptionValue('supportAllMethods', ['services'], opts);
    const useDefaultTexture = determineOptionValue('useDefaultTexture', ['services', 'triggers'], opts);
    return wrapConstructor(C, beanConstructor, lodash.assign({
      textureOfBean, supportAllMethods, useDefaultTexture, objectName: fullObjectName, streamId
    }, lodash.pick(opts, ['logger', 'tracer'])));
  }
}

ObjectDecorator.argumentSchema = {
  "$id": "objectDecorator",
  "type": "object",
  "properties": {
    "appInfo": {
      "type": "object"
    },
    "issueInspector": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    },
    "nameResolver": {
      "type": "object"
    },
    "schemaValidator": {
      "type": "object"
    },
    "profileConfig": {
      "type": "object"
    },
    "textureConfig": {
      "type": "object"
    }
  }
};

module.exports = ObjectDecorator;

function determineOptionValue(fieldName, conditional, opts) {
  if (opts) {
    if (fieldName in opts) {
      return opts[fieldName];
    }
    return (conditional.indexOf(opts.gadgetType) >= 0);
  }
  return false;
}

function wrapConstructor(refs, constructor, opts) {
  opts = opts || {};
  if (!opts.textureOfBean || opts.textureOfBean.enabled === false) {
    return constructor;
  }
  return new Proxy(constructor, {
    construct: function(target, argumentsList, newTarget) {
      function F() {
        return target.apply(this, argumentsList);
      }
      F.prototype = target.prototype;
      // F = target.bind.apply(target, [target].concat(argumentsList));
      // F = Function.prototype.bind.apply(target, [target].concat(argumentsList));
      return wrapObject(refs, new F(), opts);
    },
    apply: function(target, thisArg, argumentsList) {
      const createdObject = target.apply(thisArg, argumentsList) || thisArg;
      return wrapObject(refs, createdObject, opts);
    }
  })
}

function wrapObject(refs, object, opts) {
  if (!lodash.isObject(object) || lodash.isArray(object)) {
    return object;
  }
  opts = opts || {};
  refs = refs || {};
  const {L, T} = refs;
  const cachedFields = {};
  const cached = {};
  return new BeanProxy(object, {
    get(target, property, receiver) {
      const node = Reflect.get(target, property, receiver);
      false && L.has('dunce') && L.log('dunce', T.add({
        path: this.path, property, itemType: typeof(node)
      }).toMessage({
        text: '#{path} / #{property} -> #{itemType}'
      }));
      if (chores.isOwnOrInheritedProperty(target, property)) {
        if (lodash.isFunction(node) || lodash.isObject(node)) {
          const lane = this.slug;
          if (lane) {
            cachedFields[lane] = cachedFields[lane] || this.wrap(node);
            return cachedFields[lane];
          }
          return this.wrap(node);
        }
      }
      return node;
    },
    apply(target, thisArg, argList) {
      const methodName = lodash.get(this.path, this.path.length - 1);
      const fieldChain = lodash.slice(this.path, 0, this.path.length - 1);
      const methodPath = this.path.join('.');
      L.has('dunce') && L.log('dunce', T.add({
        objectName: opts.objectName, fieldChain, methodName, methodPath
      }).toMessage({
        text: 'Method: #{objectName}.#{methodPath} is invoked',
        info: argList
      }));
      if (!cached[methodPath]) {
        const { textureOfBean } = opts; 
        const supportAllMethods = chores.getFirstDefinedValue(
          textureOfBean && textureOfBean.supportAllMethods,
          opts.supportAllMethods);
        const emptyTexture = supportAllMethods ? {} : null;
        const texture = getTextureByPath({ textureOfBean, fieldChain, methodName }) || emptyTexture;
        if (lodash.isObject(texture)) {
          const useDefaultTexture = chores.getFirstDefinedValue(
            texture.useDefaultTexture,
            textureOfBean && textureOfBean.useDefaultTexture,
            opts.useDefaultTexture);
          if (useDefaultTexture) {
            const SELECTED = opts.streamId ? DEFAULT_TEXTURE_WITH_STREAM_ID : DEFAULT_TEXTURE;
            lodash.defaultsDeep(texture, SELECTED);
          }
        }
        const owner = thisArg || (fieldChain.length > 0 ? lodash.get(object, fieldChain) : object);
        const ownerName = opts.objectName && [opts.objectName].concat(fieldChain).join('.') || null;
        cached[methodPath] = {
          method: wrapMethod(refs, target, {
            texture: texture,
            object: owner,
            objectName: ownerName,
            methodName: methodName,
            streamId: opts.streamId,
            logger: opts.logger || object.logger,
            tracer: opts.tracer || object.tracer
          }),
          spread: isProxyRecursive(texture)
        };
      }
      const node = cached[methodPath].method.apply(thisArg, argList);
      if (node === thisArg) return node;
      if (cached[methodPath].spread && !isPromise(node)) {
        if (lodash.isFunction(node) || lodash.isObject(node)) {
          return this.wrap(node);
        }
      }
      return node;
    }
  })
}

function wrapMethod(refs, target, opts) {
  if (!lodash.isFunction(target)) return target;
  const texture = lodash.get(opts, 'texture', null);
  const loggingEnabled = isLoggingEnabled(texture);
  const mockingEnabled = isMockingEnabled(texture);
  let method = target;
  if (mockingEnabled || loggingEnabled) {
    const {objectName, methodName, streamId} = opts || {};
    const object = lodash.get(opts, 'object', null);
    const logger = opts && opts.logger || refs && refs.L;
    const tracer = opts && opts.tracer || refs && refs.T;
    if (mockingEnabled) {
      const mockingProxy = new MockingInterceptor({
        texture, object, objectName, method, methodName, logger, tracer
      });
      method = mockingProxy.capsule;
    }
    if (loggingEnabled) {
      const loggingProxy = new LoggingInterceptor({
        texture, object, objectName, method, methodName, streamId, logger, tracer
      });
      method = loggingProxy.capsule;
    }
  }
  return method;
}

function MockingInterceptor(params) {
  const { logger, tracer, texture, method, methodName, object, objectName } = params;
  const enabled = isMockingEnabled(texture) && !lodash.isEmpty(texture.mocking.mappings);
  let capsule;
  Object.defineProperty(this, 'capsule', {
    get: function() {
      if (!enabled) return method;
      return capsule = capsule || new Proxy(method, {
        apply: function(target, thisArg, argumentsList) {
          const output = {};
          const generate = getMockingGenerator(texture, thisArg, argumentsList);
          if (generate) {
            try {
              output.result = generate.apply(thisArg, argumentsList);
            } catch (error) {
              output.exception = error;
            }
            if (logger && tracer) {
              const requestId = detectRequestId(argumentsList);
              logger.has('info') && logger.log('info', tracer.add({
                objectName, methodName, requestId
              }).toMessage({
                text: 'Req[#{requestId}] #{objectName}.#{methodName} has been mocked'
              }, MODE));
            }
            if (texture.methodType === 'callback') {
              const pair = extractCallback(argumentsList);
              if (pair.callback) {
                return pair.callback.apply(null, [output.exception].concat(output.result));
              }
            }
            if (texture.methodType === 'promise') {
              if (output.exception) {
                return Promise.reject(output.exception);
              }
              return Promise.resolve(output.result);
            }
            if (output.exception) {
              throw output.exception;
            }
            return output.result;
          } else {
            if (texture.mocking.unmatched === 'exception') {
              const MockNotFoundError = errors.assertConstructor('MockNotFoundError');
              output.exception = new MockNotFoundError('All of selectors are unmatched');
              if (texture.methodType === 'promise') {
                return Promise.reject(output.exception);
              }
              if (texture.methodType === 'callback') {
                const pair = extractCallback(argumentsList);
                if (pair.callback) {
                  return pair.callback(output.exception);
                }
              }
              throw output.exception;
            } else {
              return method.apply(thisArg, argumentsList);
            }
          }
        }
      });
    }
  });
}

function getMockingGenerator(texture, thisArg, argumentsList) {
  for (const name in texture.mocking.mappings) {
    const rule = texture.mocking.mappings[name];
    if (!lodash.isFunction(rule.selector)) continue;
    if (!lodash.isFunction(rule.generate)) continue;
    if (rule.selector.apply(thisArg, argumentsList)) {
      return rule.generate;
    }
  }
  return null;
}

function LoggingInterceptor(params = {}) {
  const { logger, tracer, preciseThreshold } = params
  const { texture, object, objectName, method, methodName, streamId } = params;
  const counter = { promise: 0, callback: 0, general: 0 }
  const pointer = { current: null, actionFlow: null, preciseThreshold }

  assert.ok(lodash.isObject(logger));
  assert.ok(lodash.isObject(tracer));
  assert.ok(lodash.isObject(texture));
  assert.ok(lodash.isFunction(method));

  // pre-processing logging texture
  const methodType = texture.methodType;
  pointer.preciseThreshold = pointer.preciseThreshold || 5;

  function createListener(texture, eventName) {
    const onEventName = 'on' + eventName;
    const onEvent = texture.logging && texture.logging[onEventName];
    if (!isEnabled(onEvent)) return NOOP;
    return function (logState, data, extra) {
      // determine the requestId
      if (lodash.isFunction(onEvent.getRequestId) && eventName === 'Request') {
        let reqId = null;
        if (onEvent.getRequestId === DEFAULT_TEXTURE.logging[onEventName].getRequestId) {
          reqId = onEvent.getRequestId(data);
        } else {
          try {
            reqId = onEvent.getRequestId.call(logState.reqContext, data, extra);
          } catch (fatal) {
            reqId = 'getRequestId-throw-an-error';
          }
        }
        if (reqId) {
          logState.requestId = reqId;
          logState.requestType = 'link';
        } else {
          logState.requestId = chores.getUUID();
          logState.requestType = 'head';
        }
      }
      // determine the action type (i.e. explicit or implicit)
      if (pointer.actionFlow) {
        logState.actionFlow = pointer.actionFlow;
      }
      const msgObj = {
        text: "Req[#{requestId}] #{objectName}.#{methodName}"
      }
      switch (eventName) {
        case 'Request':
          msgObj.text += ' is invoked';
          break;
        case 'Success':
          msgObj.text += ' has done';
          break;
        case 'Failure':
          msgObj.text += ' has failed';
          break;
      }
      if (lodash.isFunction(onEvent.extractInfo)) {
        if (onEvent.extractInfo === DEFAULT_TEXTURE.logging[onEventName].extractInfo) {
          msgObj.info = onEvent.extractInfo(data);
        } else {
          try {
            msgObj.info = onEvent.extractInfo.call(logState.reqContext, data, extra);
          } catch (fatal) {
            msgObj.info = {
              event: onEventName,
              errorName: fatal.name,
              errorMessage: fatal.message
            }
          }
        }
      }
      if (lodash.isString(onEvent.template)) {
        msgObj.text = onEvent.template;
      }
      msgObj.tags = onEvent.tags || texture.tags;
      if (!lodash.isArray(msgObj.tags) && lodash.isEmpty(msgObj.tags)) {
        delete msgObj.tags;
      }
      const logLevel = onEvent.logLevel || (eventName === 'Failure' ? 'error' : 'debug');
      logger.has(logLevel) && logger.log(logLevel, tracer.add(logState).toMessage(msgObj, MODE));
    }
  }
  const CALLED_EVENTS = ['Request', 'Success', 'Failure'];
  const logOnEvent = lodash.mapValues(lodash.keyBy(CALLED_EVENTS), function(value) {
    return createListener(texture, value);
  });

  const __state__ = { object, method, methodType, counter, pointer }

  let capsule;
  Object.defineProperty(this, 'capsule', {
    get: function() {
      return capsule = capsule || new Proxy(method, {
        apply: function(target, thisArg, argumentsList) {
          const logState = { streamId, objectName, methodName, reqContext: {} }
          return callMethod(__state__, argumentsList, logOnEvent, logState);
        }
      });
    }
  })

  this.getState = function() {
    return lodash.cloneDeep(lodash.pick(__state__, [ 'methodType', 'counter', 'pointer' ]));
  }
}

function callMethod(refs, argumentsList, logOnEvent, logState) {
  const { object, method, methodType, counter, pointer } = refs;

  function _detect(argumentsList) {
    let result = null, exception = null, found = false;
    const pair = proxifyCallback(argumentsList, logOnEvent, logState, function() {
      hitMethodType(pointer, counter, 'callback');
    });
    try {
      logOnEvent.Request(logState, pair.parameters);
      result = method.apply(object, pair.parameters);
      if (isPromise(result)) {
        found = true;
        hitMethodType(pointer, counter, 'promise');
        result = Promise.resolve(result).then(function(value) {
          logOnEvent.Success(logState, value);
          return value;
        }).catch(function(error) {
          logOnEvent.Failure(logState, error);
          return Promise.reject(error);
        });
      } else {
        logOnEvent.Success(logState, result);
      }
    } catch (error) {
      exception = error;
      logOnEvent.Failure(logState, exception);
    }
    if (!found) {
      hitMethodType(pointer, counter, 'general');
    }
    // return both result & exception
    return {result, exception};
  }

  function _invoke(argumentsList) {
    let result = undefined, exception = undefined;
    switch(methodType) {
      case 'promise': {
        result = Promise.resolve().then(function() {
          logOnEvent.Request(logState, argumentsList);
          return method.apply(object, argumentsList)
        })
        .then(function(value) {
          logOnEvent.Success(logState, value);
          return value;
        })
        .catch(function(error) {
          logOnEvent.Failure(logState, error);
          return Promise.reject(error);
        })
        break;
      }
      case 'callback': {
        try {
          const pair = proxifyCallback(argumentsList, logOnEvent, logState);
          logOnEvent.Request(logState, pair.parameters);
          result = method.apply(object, pair.parameters);
        } catch (error) {
          exception = error;
          logOnEvent.Failure(logState, exception);
        }
        break;
      }
      default: {
        try {
          logOnEvent.Request(logState, argumentsList);
          result = method.apply(object, argumentsList);
          logOnEvent.Success(logState, result);
        } catch (error) {
          exception = error;
          logOnEvent.Failure(logState, exception);
        }
        break;
      }
    }
    return {result, exception};
  }

  argumentsList = chores.argumentsToArray(argumentsList);

  let output = null;
  if (methodType) {
    pointer.actionFlow = 'explicit';
    output = _invoke(argumentsList);
  } else {
    pointer.actionFlow = 'implicit';
    output = _detect(argumentsList);
    refs.methodType = suggestMethodType(pointer, counter, methodType);
  }
  // an error is occurred
  if (output.exception) {
    throw output.exception;
  }
  return output.result;
}

function hitMethodType(pointer, counter, methodType) {
  if (methodType) {
    if (methodType === 'callback') {
      counter[methodType]++;
    } else {
      if (methodType !== pointer.current && pointer.current) {
        for (const name in counter) {
          counter[name] = 0;
        }
      }
      pointer.current = methodType;
      counter[methodType]++;
    }
  } else {
    counter.total = counter.total || 0;
    counter.total++;
  }
}

function suggestMethodType(pointer, counter, methodType) {
  const threshold = pointer.preciseThreshold || 100;
  let max = 'promise', min = 'general';
  if (counter[max] < counter[min]) {
    let tmp = max; max = min; min = tmp;
  }
  if (counter[max] >= threshold) {
    if (counter['callback'] / counter[max] > 0.7) {
      return 'callback';
    }
    if (counter[min] === 0) {
      return max;
    }
  }
  return methodType;
}

function isPromise(p) {
  return lodash.isObject(p) && lodash.isFunction(p.then);
}

function extractCallback(argumentsList) {
  const r = {};
  r.callback = argumentsList.length > 0 && argumentsList[argumentsList.length - 1] || null;
  if (typeof r.callback === 'function') {
    r.parameters = Array.prototype.slice.call(argumentsList, 0, argumentsList.length - 1);
  } else {
    r.parameters = argumentsList;
    delete r.callback;
  }
  return r;
}

function proxifyCallback(argumentsList, logOnEvent, logState, checker) {
  const pair = extractCallback(argumentsList);
  if (pair.callback) {
    pair.parameters.push(new Proxy(pair.callback, {
      apply: function(target, thisArg, callbackArgs) {
        (typeof checker === 'function') && checker();
        const error = callbackArgs[0];
        if (error) {
          logOnEvent.Failure(logState, error);
        } else {
          logOnEvent.Success(logState, ...Array.prototype.slice.call(callbackArgs, 1));
        }
        return pair.callback.apply(thisArg, callbackArgs);
      }
    }));
  }
  return pair;
}

function isEnabled(section) {
  return section && section.enabled !== false;
}

function isLoggingEnabled(texture) {
  return isEnabled(texture) && isEnabled(texture.logging);
}

function isMockingEnabled(texture) {
  return isEnabled(texture) && isEnabled(texture.mocking);
}

function getTextureByPath({textureOfBean, fieldChain, methodName}) {
  let texture = null;
  if (nodash.isObject(textureOfBean)) {
    const beanToMethod = [];
    if (nodash.isArray(fieldChain) && fieldChain.length > 0) {
      Array.prototype.push.apply(beanToMethod, fieldChain);
    }
    if (methodName) {
      beanToMethod.push(methodName);
    }
    texture = lodash.get(textureOfBean, ['methods'].concat(beanToMethod));
    texture = texture || lodash.get(textureOfBean, ['methods', beanToMethod.join('.')], texture);
  }
  return propagateEnabled(texture, textureOfBean);
}

function getBridgeFullname({pluginName, bridgeCode, dialectName}) {
  return pluginName + chores.getSeparator() + bridgeCode + '#' + dialectName;
}

function getTextureOfBridge({textureStore, pluginCode, bridgeCode, dialectName, dialectPath}) {
  const rootToBean = [];
  if (lodash.isArray(dialectPath) && !lodash.isEmpty(dialectPath)) {
    rootToBean.push("bridges");
    Array.prototype.push.apply(rootToBean, dialectPath);
  } else {
    if (pluginCode && bridgeCode && dialectName) {
      rootToBean.push("bridges", bridgeCode, pluginCode, dialectName);
    }
  }
  const textureOfBean = (rootToBean.length > 0) ? lodash.get(textureStore, rootToBean) : textureStore;
  return propagateEnabled(textureOfBean, textureStore);
}

function getPluginFullname({pluginName, gadgetType, gadgetName}) {
  return pluginName + chores.getSeparator() + gadgetName;
}

function getTextureOfPlugin({textureStore, pluginCode, gadgetType, gadgetName}) {
  const rootToBean = [];
  if (pluginCode) {
    if (chores.isSpecialBundle(pluginCode)) {
      rootToBean.push(pluginCode);
    } else {
      rootToBean.push('plugins', pluginCode);
    }
    if (gadgetType) {
      rootToBean.push(gadgetType);
      if (gadgetName) {
        rootToBean.push(gadgetName);
      }
    }
  }
  const textureOfBean = (rootToBean.length > 0) ? lodash.get(textureStore, rootToBean) : textureStore;
  return propagateEnabled(textureOfBean, textureStore);
}

function propagateEnabled(childTexture, parentTexture) {
  if (parentTexture && parentTexture.enabled === false) {
    if (childTexture && childTexture.enabled == undefined) {
      childTexture.enabled = parentTexture.enabled;
    }
  }
  return childTexture;
}

function detectRequestId(argumentsList) {
  let reqId = undefined;
  if (argumentsList && argumentsList.length > 0) {
    for (let k=(argumentsList.length-1); k>=0; k--) {
      const o = argumentsList[k];
      reqId = o && (o.requestId || o.reqId);
      if (typeof reqId === 'string') break;
    }
  }
  return reqId;
}

function isProxyRecursive(texture) {
  if (!texture) return false;
  const fields = ['recursive', 'spread', 'outspread', 'nested', 'wrapped'];
  for (const i in fields) {
    if (texture[fields[i]]) return true;
  }
  return false;
}

function extractStreamId(logging, appInfo, instanceId) {
  if (lodash.isObject(logging)) {
    if (logging.enabled === false) {
      return undefined;
    }
    if (lodash.isString(logging.streamIdExpression)) {
      return chores.formatTemplate(logging.streamIdExpression, appInfo);
    }
    if (lodash.isFunction(logging.streamIdExtractor)) {
      try {
        const streamId = logging.streamIdExtractor(lodash.pick(appInfo, [
          'name', 'version', 'framework.name', 'framework.version'
        ]), instanceId);
        if (lodash.isString(streamId)) return streamId;
      } catch (fatal) {
        return instanceId || 'streamIdExtractor-throw-an-error';
      }
    }
  }
  return instanceId;
}

const DEFAULT_TEXTURE = {
  logging: {
    onRequest: {
      getRequestId: detectRequestId,
      extractInfo: function(argumentsList) {
        return chores.extractObjectInfo(chores.argumentsToArray(argumentsList));
      },
      template: "Req[#{requestId}] #{objectName}.#{methodName}() #{requestType}"
    },
    onSuccess: {
      extractInfo: function(result) {
        return chores.extractObjectInfo(result);
      },
      template: "Req[#{requestId}] #{objectName}.#{methodName}() completed"
    },
    onFailure: {
      extractInfo: function(error) {
        error = error || { code: 'null' };
        return {
          errorName: error.name,
          errorCode: error.code,
          errorMessage: error.message
        }
      },
      template: "Req[#{requestId}] #{objectName}.#{methodName}() failed"
    }
  }
}

const DEFAULT_TEXTURE_WITH_STREAM_ID = lodash.defaultsDeep({
  logging: {
    onRequest: {
      template: "Req[#{requestId}/#{streamId}] #{objectName}.#{methodName}() #{requestType}"
    },
    onSuccess: {
      template: "Req[#{requestId}/#{streamId}] #{objectName}.#{methodName}() completed"
    },
    onFailure: {
      template: "Req[#{requestId}/#{streamId}] #{objectName}.#{methodName}() failed"
    }
  }
}, DEFAULT_TEXTURE);
