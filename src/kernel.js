'use strict';

var Injektor = require('injektor');
var lodash = require('lodash');
var path = require('path');
var chores = require('./utils/chores.js');
var LoggingWrapper = require('./backbone/logging-wrapper.js');

var CONSTRUCTORS = {};
chores.loadServiceByNames(CONSTRUCTORS, path.join(__dirname, 'backbone'), [
  'sandbox-manager', 'schema-validator', 'script-executor', 'script-renderer',
  'security-manager', 'bridge-loader', 'plugin-loader', 'logging-factory'
]);

function Kernel(params) {
  var loggingWrapper = new LoggingWrapper(chores.getBlockRef(__filename));
  var LX = loggingWrapper.getLogger();
  var LT = loggingWrapper.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start ...'
  }));

  // init the default parameters
  params = params || {};

  // create injektor instance
  var injektor = new Injektor({ separator: chores.getSeparator() });

  ['appName', 'appInfo', 'bridgeRefs', 'pluginRefs'].forEach(function(refName) {
    injektor.registerObject(refName, params[refName], chores.injektorContext);
  });

  injektor
    .registerObject('sandboxNames', params['sandbox']['names'], chores.injektorContext)
    .registerObject('sandboxConfig', params['sandbox']['mixture'], chores.injektorContext)
    .registerObject('profileNames', params['profile']['names'], chores.injektorContext)
    .registerObject('profileConfig', params['profile']['mixture'], chores.injektorContext);

  lodash.forOwn(CONSTRUCTORS, function(constructor, serviceName) {
    injektor.defineService(serviceName, constructor, chores.injektorContext);
  });

  this.invoke = function(block) {
    return lodash.isFunction(block) && Promise.resolve(block(injektor));
  }

  this._injektor = injektor;

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
}

module.exports = Kernel;
