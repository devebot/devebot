'use strict';

var Injektor = require('injektor');
var lodash = require('lodash');

var SandboxManager = require('./backbone/sandbox-manager.js');
var SchemaValidator = require('./backbone/schema-validator.js');
var ScriptExecutor = require('./backbone/script-executor.js');
var ScriptRenderer = require('./backbone/script-renderer.js');
var SecurityManager = require('./backbone/security-manager.js');
var BridgeLoader = require('./backbone/bridge-loader.js');
var PluginLoader = require('./backbone/plugin-loader.js');
var LoggingFactory = require('./backbone/logging-factory.js');
var LoggingWrapper = require('./backbone/logging-wrapper.js');

var chores = require('./utils/chores.js');

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

  injektor
    .registerObject('appinfo', params['appinfo'], chores.injektorContext)
    .registerObject('bridgeRefs', params['bridgeRefs'], chores.injektorContext)
    .registerObject('pluginRefs', params['pluginRefs'], chores.injektorContext)
    .registerObject('sandboxNames', params['sandbox']['names'], chores.injektorContext)
    .registerObject('sandboxConfig', params['sandbox']['staging'], chores.injektorContext)
    .registerObject('profileNames', params['profile']['names'], chores.injektorContext)
    .registerObject('profileConfig', params['profile']['staging'], chores.injektorContext)
    .defineService('sandboxManager', SandboxManager, chores.injektorContext)
    .defineService('schemaValidator', SchemaValidator, chores.injektorContext)
    .defineService('scriptExecutor', ScriptExecutor, chores.injektorContext)
    .defineService('scriptRenderer', ScriptRenderer, chores.injektorContext)
    .defineService('securityManager', SecurityManager, chores.injektorContext)
    .defineService('bridgeLoader', BridgeLoader, chores.injektorContext)
    .defineService('pluginLoader', PluginLoader, chores.injektorContext)
    .defineService('loggingFactory', LoggingFactory, chores.injektorContext);

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
