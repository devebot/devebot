'use strict';

var Injektor = require('injektor');
var lodash = require('lodash');

var CommandManager = require('./backbone/command-manager.js');
var ProcessMonitor = require('./backbone/process-monitor.js');
var SandboxManager = require('./backbone/sandbox-manager.js');
var SchemaValidator = require('./backbone/schema-validator.js');
var ScriptExecutor = require('./backbone/script-executor.js');
var ScriptRenderer = require('./backbone/script-renderer.js');
var SecurityManager = require('./backbone/security-manager.js');
var BridgeLoader = require('./backbone/bridge-loader.js');
var PluginLoader = require('./backbone/plugin-loader.js');
var LoggingFactory = require('./backbone/logging-factory.js');

var debugx = require('./utils/debug.js')('devebot:kernel');

function Kernel(params) {
  debugx.enabled && debugx(' + initialization start ...');

  // init the default parameters
  params = params || {};

  // create injektor instance
  var injektor = new Injektor();

  injektor
    .registerObject('appinfo', params['appinfo'])
    .registerObject('bridgeRefs', params['bridgeRefs'])
    .registerObject('pluginRefs', params['pluginRefs'])
    .registerObject('sandboxList', params['sandbox']['staging'])
    .registerObject('profileConfig', params['profile']['staging'])
    .defineService('commandManager', CommandManager)
    .defineService('processMonitor', ProcessMonitor)
    .defineService('sandboxManager', SandboxManager)
    .defineService('schemaValidator', SchemaValidator)
    .defineService('scriptExecutor', ScriptExecutor)
    .defineService('scriptRenderer', ScriptRenderer)
    .defineService('securityManager', SecurityManager)
    .defineService('bridgeLoader', BridgeLoader)
    .defineService('pluginLoader', PluginLoader)
    .defineService('loggingFactory', LoggingFactory);

  this.invoke = function(block) {
    return lodash.isFunction(block) && Promise.resolve(block(injektor));
  }

  this._injektor = injektor;

  debugx.enabled && debugx(' - initialization has finished');
}

module.exports = Kernel;
