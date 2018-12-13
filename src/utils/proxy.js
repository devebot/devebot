'use strict';

const toPath = require('lodash/toPath');

const nameIndexOf = {
  get: 1,
  set: 1,
  has: 1,
  defineProperty: 1,
  deleteProperty: 1,
  enumerate: 1,
  getOwnPropertyDescriptor: 1,
}

const trapNames = [
  'apply',
  'construct',
  'getPrototypeOf',
  'setPrototypeOf',
  'isExtensible',
  'preventExtensions',
  'ownKeys',
].concat(Object.keys(nameIndexOf))

function BeanProxy(rootTarget, handler, options) {
  function createProxy(target, path) {
    const context = { rootTarget, path };
    const realTraps = {};
    for (const trapName of trapNames) {
      const nameIndex = nameIndexOf[trapName], trap = handler[trapName];
      if (isFunction(trap)) {
        realTraps[trapName] = function () {
          const name = isNumber(nameIndex) ? arguments[nameIndex] : null;
          context.nest = function (nestedTarget) {
            if (isUndefined(nestedTarget)) {
              nestedTarget = isString(name) ? rootTarget : {};
            }
            const nestedPath = isString(name) ? [].concat(path, name) : path;
            return createProxy(nestedTarget, nestedPath);
          }
          return trap.apply(context, arguments);
        }
      }
    }
    return new Proxy(target, realTraps);
  }
  return createProxy(rootTarget, extractPath(options));
}

module.exports = BeanProxy;

function extractPath(options) {
  return options && options.path ? toPath(options.path) : [];
}

function isFunction(f) {
  return (typeof f === 'function');
}

function isNumber(n) {
  return (typeof n === 'number');
}

function isString(s) {
  return (typeof s === 'string');
}

function isUndefined(v) {
  return (typeof v === 'undefined');
}
