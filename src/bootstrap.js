'use strict';

const path = require('path');
const util = require('util');
const lodash = require('lodash');
const minimist = require('minimist');
const appinfoLoader = require('./backbone/appinfo-loader');
const IssueInspector = require('./backbone/issue-inspector');
const StateInspector = require('./backbone/state-inspector');
const ManifestHandler = require('./backbone/manifest-handler');
const ConfigLoader = require('./backbone/config-loader');
const ContextManager = require('./backbone/context-manager');
const LoggingWrapper = require('./backbone/logging-wrapper');
const NameResolver = require('./backbone/name-resolver');
const chores = require('./utils/chores');
const constx = require('./utils/constx');
const envbox = require('./utils/envbox');
const errors = require('./utils/errors');
const nodash = require('./utils/nodash');
const Runner = require('./runner');
const Server = require('./server');
const blockRef = chores.getBlockRef(__filename);
const issueInspector = IssueInspector.instance;
const stateInspector = StateInspector.instance;
const FRAMEWORK_CAPNAME = lodash.capitalize(constx.FRAMEWORK.NAME);

function appLoader(params = {}) {
  const {logger: L, tracer: T} = params;

  L.has('silly') && L.log('silly', T.add({ context: lodash.cloneDeep(params) }).toMessage({
    tags: [ blockRef, 'constructor-begin', 'appLoader' ],
    text: ' + application loading start ...'
  }));

  const appRootPath = params.appRootPath;
  const libRootPaths = lodash.map(params.pluginRefs, function(pluginRef) {
    return pluginRef.path;
  });
  const topRootPath = path.join(__dirname, '/..');

  const appInfo = appinfoLoader(appRootPath, libRootPaths, topRootPath);
  const appName = params.appName || appInfo.name || constx.FRAMEWORK.NAME + '-application';
  const options = {
    privateProfile: params.privateProfile || params.privateProfiles,
    privateSandbox: params.privateSandbox || params.privateSandboxes,
    privateTexture: params.privateTexture || params.privateTextures,
  };

  L.has('dunce') && L.log('dunce', T.add({ appName }).toMessage({
    text: ' - application name (appName): ${appName}'
  }));

  const appRef = { type: 'application', name: appName };
  if (lodash.isString(appRootPath)) {
    appRef.path = appRootPath;
  }
  if (lodash.isObject(params.presets)) {
    appRef.presets = lodash.cloneDeep(params.presets);
  }

  const devebotRef = {
    type: 'framework',
    name: constx.FRAMEWORK.NAME,
    path: topRootPath
  };

  // declare user-defined environment variables
  const currentEnvNames = envbox.getEnvNames();
  const evDescriptors = lodash.get(params, ['environmentVarDescriptors'], []);
  const duplicated = lodash.filter(evDescriptors, function(ev) {
    return currentEnvNames.indexOf(ev.name) >= 0;
  });
  if (duplicated.length > 0) {
    issueInspector.collect({
      hasError: true,
      stage: 'bootstrap',
      type: 'application',
      name: appName,
      stack: duplicated.map(function(ev) {
        const evName = chores.stringLabelCase(appName) + '_' + ev.name;
        return util.format('- Environment Variable "%s" has already been defined', evName)
      }).join('\n')
    });
  } else {
    envbox.define(evDescriptors);
  }

  // freeze occupied environment variables
  envbox.setNamespace(chores.stringLabelCase(appName), {
    occupyValues: params.environmentVarOccupied,
    ownershipLabel: util.format('<owned-by-%s>', appName)
  });

  const bridgeList = lodash.values(params.bridgeRefs);
  const pluginList = lodash.values(params.pluginRefs);
  const bundleList = [].concat(appRef, pluginList, devebotRef);

  const nameResolver = new NameResolver({ issueInspector, bridgeList, pluginList });
  const manifestHandler = new ManifestHandler({ nameResolver, issueInspector, bridgeList, bundleList });

  stateInspector.register({ nameResolver, bridgeList, pluginList });

  const configLoader = new ConfigLoader({ options,
    appRef, devebotRef, pluginRefs: params.pluginRefs, bridgeRefs: params.bridgeRefs,
    nameResolver, issueInspector, stateInspector, manifestHandler
  });

  const contextManager = new ContextManager({ issueInspector });
  contextManager.addDefaultFeatures(params.defaultFeatures);

  const _app_ = {};
  const _ref_ = {};

  Object.defineProperty(_app_, 'config', {
    get: function() {
      if (_ref_.config === undefined || _ref_.config === null) {
        _ref_.config = configLoader.load();
        _ref_.config.appName = appName;
        _ref_.config.appInfo = appInfo;
        _ref_.config.bridgeList = bridgeList;
        _ref_.config.bundleList = bundleList;
        if (!chores.isUpgradeSupported('config-extended-fields')) {
          _ref_.config.bridgeRefs = bridgeList; // @Deprecated
          _ref_.config.pluginRefs = bundleList; // @Deprecated
        }
      }
      return _ref_.config;
    },
    set: function(value) {}
  });

  Object.defineProperty(_app_, 'runner', {
    get: function() {
      _ref_.runner = _ref_.runner || new Runner({
        appName,
        appInfo,
        bridgeList,
        bundleList,
        configObject: this.config,
        contextManager,
        issueInspector,
        stateInspector,
        nameResolver,
        manifestHandler,
      });
      return _ref_.runner;
    },
    set: function(value) {}
  });

  Object.defineProperty(_app_, 'server', {
    get: function() {
      _ref_.server = _ref_.server || new Server({
        appName,
        appInfo,
        bridgeList,
        bundleList,
        configObject: this.config,
        contextManager,
        issueInspector,
        stateInspector,
        nameResolver,
        manifestHandler,
      });
      return _ref_.server;
    },
    set: function(value) {}
  });

  L.has('silly') && L.log('silly', T.toMessage({
    tags: [ blockRef, 'constructor-end', 'appLoader' ],
    text: ' - Application loading has done'
  }));

  return _app_;
}

const ATTRS = ['libRootPaths', 'pluginRefs', 'bridgeRefs'];

function registerLayerware(context, pluginNames, bridgeNames) {
  if ((arguments.length < 3) && lodash.isArray(context)) {
    bridgeNames = pluginNames;
    pluginNames = context;
    context = null;
  }

  context = lodash.isString(context) ? { layerRootPath: context } : context;
  if (!lodash.isEmpty(context)) {
    const result = chores.validate(context, constx.BOOTSTRAP.registerLayerware.context.schema);
    if (!result.ok) {
      issueInspector.collect({
        stage: 'bootstrap',
        type: 'application',
        name: 'registerLayerware',
        hasError: true,
        stack: JSON.stringify(result.errors, null, 4)
      });
    }
  }
  context = context || {};

  const loggingWrapper = new LoggingWrapper(blockRef);
  context.logger = loggingWrapper.getLogger();
  context.tracer = loggingWrapper.getTracer();

  if (!lodash.isEmpty(pluginNames)) {
    const result = chores.validate(pluginNames, constx.BOOTSTRAP.registerLayerware.plugins.schema);
    if (!result.ok) {
      issueInspector.collect({
        stage: 'bootstrap',
        type: 'application',
        name: 'registerLayerware',
        hasError: true,
        stack: JSON.stringify(result.errors, null, 4)
      });
    }
  }

  if (!lodash.isEmpty(bridgeNames)) {
    const result = chores.validate(bridgeNames, constx.BOOTSTRAP.registerLayerware.bridges.schema);
    if (!result.ok) {
      issueInspector.collect({
        stage: 'bootstrap',
        type: 'application',
        name: 'registerLayerware',
        hasError: true,
        stack: JSON.stringify(result.errors, null, 4)
      });
    }
  }

  function initialize(context, pluginNames, bridgeNames, accumulator) {
    context = context || {};
    accumulator = accumulator || {};

    const {logger: L, tracer: T} = context;
    lodash.defaults(accumulator, lodash.pick(context, ['logger', 'tracer']));

    if (context.layerRootPath && context.layerRootPath != accumulator.libRootPath) {
      L.has('warn') && L.log('warn', T.add({
        layerRootPath: context.layerRootPath,
        libRootPath: accumulator.libRootPath
      }).toMessage({
        text: ' - layerRootPath is different with libRootPath'
      }));
    }

    if (typeof(context.layerRootPath) === 'string' && context.layerRootPath.length > 0) {
      accumulator.libRootPaths = accumulator.libRootPaths || [];
      accumulator.libRootPaths.push(context.layerRootPath);
    }

    if (!chores.isUpgradeSupported('presets')) {
      return expandExtensions(accumulator, pluginNames, bridgeNames);
    }

    if (accumulator.libRootPath) {
      const newPresets = context.presets || {};
      const oldPresets = lodash.get(accumulator, ['pluginRefs', accumulator.libRootPath, 'presets'], null);
      if (oldPresets) {
        lodash.defaultsDeep(oldPresets, newPresets);
      } else {
        lodash.set(accumulator, ['pluginRefs', accumulator.libRootPath, 'presets'], newPresets);
      }
    }
    return expandExtensions(accumulator, pluginNames, bridgeNames);
  };

  return initialize.bind(undefined, context, pluginNames, bridgeNames);
}

function launchApplication(context, pluginNames, bridgeNames) {
  context = lodash.isString(context) ? { appRootPath: context } : context;
  if (!lodash.isEmpty(context)) {
    const result = chores.validate(context, constx.BOOTSTRAP.launchApplication.context.schema);
    if (!result.ok) {
      issueInspector.collect({
        stage: 'bootstrap',
        type: 'application',
        name: 'launchApplication',
        hasError: true,
        stack: JSON.stringify(result.errors, null, 4)
      });
    }
  }
  context = context || {};

  if (lodash.isString(context.appRootPath)) {
    context.libRootPath = context.appRootPath;
  }

  const loggingWrapper = new LoggingWrapper(blockRef);
  context.logger = loggingWrapper.getLogger();
  context.tracer = loggingWrapper.getTracer();

  if (!lodash.isEmpty(pluginNames)) {
    const result = chores.validate(pluginNames, constx.BOOTSTRAP.launchApplication.plugins.schema);
    if (!result.ok) {
      issueInspector.collect({
        stage: 'bootstrap',
        type: 'application',
        name: 'launchApplication',
        hasError: true,
        stack: JSON.stringify(result.errors, null, 4)
      });
    }
  }

  if (!lodash.isEmpty(bridgeNames)) {
    const result = chores.validate(bridgeNames, constx.BOOTSTRAP.launchApplication.bridges.schema);
    if (!result.ok) {
      issueInspector.collect({
        stage: 'bootstrap',
        type: 'application',
        name: 'launchApplication',
        hasError: true,
        stack: JSON.stringify(result.errors, null, 4)
      });
    }
  }

  return appLoader(lodash.assign(context, expandExtensions(lodash.omit(context, ATTRS), pluginNames, bridgeNames)));
}

function expandExtensions(accumulator, pluginNames, bridgeNames) {
  accumulator = accumulator || {};
  accumulator.bridgeRefs = accumulator.bridgeRefs || {};
  accumulator.pluginRefs = accumulator.pluginRefs || {};
  const context = lodash.pick(accumulator, ATTRS.concat(['logger', 'tracer']));
  const {logger: L, tracer: T} = context;

  context.libRootPaths = context.libRootPaths || [];
  context.bridgeRefs = context.bridgeRefs || {};
  context.pluginRefs = context.pluginRefs || {};

  bridgeNames = nodash.arrayify(bridgeNames || []);
  pluginNames = nodash.arrayify(pluginNames || []);

  const CTX = { issueInspector };

  const bridgeInfos = lodash.map(bridgeNames, function(bridgeName) {
    const item = lodash.isString(bridgeName) ? { name: bridgeName, path: bridgeName } : bridgeName;
    item.type = 'bridge';
    if (!chores.isUpgradeSupported('presets')) { return item }
    item.path = locatePackage(CTX, item, 'bridge');
    return item;
  });
  const pluginInfos = lodash.map(pluginNames, function(pluginName) {
    const item = lodash.isString(pluginName) ? { name: pluginName, path: pluginName } : pluginName;
    item.type = 'plugin';
    if (!chores.isUpgradeSupported('presets')) { return item }
    item.path = locatePackage(CTX, item, 'plugin');
    return item;
  });

  // create the bridge & plugin dependencies
  if (lodash.isString(accumulator.libRootPath)) {
    const crateRef = accumulator.pluginRefs[accumulator.libRootPath];
    if (lodash.isObject(crateRef)) {
      crateRef.bridgeDepends = lodash.map(bridgeInfos, function(item) {
        return item.name;
      });
      crateRef.pluginDepends = lodash.map(pluginInfos, function(item) {
        return item.name;
      });
      L.has('debug') && L.log('debug', T.add({
        libRootPath: accumulator.libRootPath,
        crateObject: crateRef
      }).toMessage({
        text: ' - crate "${libRootPath}" object: ${crateObject}'
      }));
    } else {
      L.has('warn') && L.log('warn', T.add({
        libRootPath: accumulator.libRootPath
      }).toMessage({
        text: ' - crate "${libRootPath}" hasnot defined'
      }));
    }
  }

  const bridgeDiffs = lodash.differenceWith(bridgeInfos, lodash.keys(context.bridgeRefs), function(bridgeInfo, bridgeKey) {
    if (!chores.isUpgradeSupported('presets')) {
      return (bridgeInfo.name == bridgeKey);
    }
    return (bridgeInfo.path == bridgeKey);
  });
  const pluginDiffs = lodash.differenceWith(pluginInfos, lodash.keys(context.pluginRefs), function(pluginInfo, pluginKey) {
    if (!chores.isUpgradeSupported('presets')) {
      return (pluginInfo.name == pluginKey);
    }
    return (pluginInfo.path == pluginKey);
  });

  bridgeDiffs.forEach(function(bridgeInfo) {
    if (!chores.isUpgradeSupported('presets')) {
      context.bridgeRefs[bridgeInfo.name] = {
        name: bridgeInfo.name,
        type: bridgeInfo.type,
        path: locatePackage(CTX, bridgeInfo, 'bridge')
      }
      return;
    }
    const inc = lodash.pick(bridgeInfo, ['name', 'type', 'path', 'presets']);
    context.bridgeRefs[bridgeInfo.path] = lodash.assign(context.bridgeRefs[bridgeInfo.path], inc);
  });

  pluginDiffs.forEach(function(pluginInfo) {
    if (!chores.isUpgradeSupported('presets')) {
      context.pluginRefs[pluginInfo.name] = {
        name: pluginInfo.name,
        type: pluginInfo.type,
        path: locatePackage(CTX, pluginInfo, 'plugin')
      }
      return;
    }
    const inc = lodash.pick(pluginInfo, ['name', 'type', 'path', 'presets']);
    context.pluginRefs[pluginInfo.path] = lodash.assign(context.pluginRefs[pluginInfo.path], inc);
  });

  issueInspector.barrier({ invoker: blockRef, footmark: 'package-touching' });

  const pluginInitializers = lodash.map(pluginDiffs, function(pluginInfo) {
    if (!chores.isUpgradeSupported('presets')) {
      return require(pluginInfo.path);
    }
    return {
      path: pluginInfo.path,
      initializer: require(pluginInfo.path)
    }
  });

  return pluginInitializers.reduce(function(params, pluginInitializer) {
    if (!chores.isUpgradeSupported('presets')) {
      return pluginInitializer(params);
    }
    params.libRootPath = pluginInitializer.path;
    return pluginInitializer.initializer(params);
  }, context);
};

const bootstrap = {};

bootstrap.registerLayerware = registerLayerware;
bootstrap.launchApplication = launchApplication;

// @Deprecated
bootstrap.parseArguments = function(active) {
  return this.initialize('actions', { enabled: active, forced: true });
}

bootstrap.initialize = function(action, options = {}) {
  if (['actions', 'tasks'].indexOf(action) >= 0) {
    if (options.enabled !== false) {
      const argv = minimist(process.argv.slice(2));
      const tasks = argv.tasks || argv.actions;
      if (lodash.isEmpty(tasks)) {
        if (options.forced && !lodash.isEmpty(argv._)) {
          console.info('Incorrect task(s). Should be: (--tasks=print-config,check-config)');
          process.exit(0);
        }
      } else {
        const jobs = stateInspector.init({ tasks });
        if (lodash.isEmpty(jobs)) {
          console.info('Unknown task(s): (%s)!', tasks);
          process.exit(0);
        }
      }
    }
  }
  return this;
}

const builtinPackages = ['bluebird', 'lodash', 'injektor', 'logolite', 'schemato', 'semver', 'codetags'];
const internalModules = ['chores', 'loader', 'pinbug', 'errors'];

bootstrap.require = function(packageName) {
  if (builtinPackages.indexOf(packageName) >= 0) return require(packageName);
  if (internalModules.indexOf(packageName) >= 0) return require('./utils/' + packageName);
  if (packageName == 'debug') return require('./utils/pinbug');
  return null;
};

function locatePackage({issueInspector} = {}, pkgInfo) {
  chores.assertOk(issueInspector, pkgInfo, pkgInfo.name, pkgInfo.type, pkgInfo.path);
  try {
    const entrypoint = require.resolve(pkgInfo.path);
    const buf = {};
    buf.packagePath = path.dirname(entrypoint);
    buf.packageJson = chores.loadPackageInfo(buf.packagePath);
    while (buf.packageJson === null) {
      const parentPath = path.dirname(buf.packagePath);
      if (parentPath === buf.packagePath) break;
      buf.packagePath = parentPath;
      buf.packageJson = chores.loadPackageInfo(buf.packagePath);
    }
    if (nodash.isObject(buf.packageJson)) {
      if (nodash.isString(buf.packageJson.main)) {
        const verifiedPath = require.resolve(path.join(buf.packagePath, buf.packageJson.main));
        if (verifiedPath !== entrypoint) {
          const MismatchedMainError = errors.assertConstructor('PackageError');
          throw new MismatchedMainError("package.json file's [main] attribute is mismatched");
        }
      }
      if (nodash.isString(pkgInfo.name)) {
        if (pkgInfo.name !== buf.packageJson.name) {
          const MismatchedNameError = errors.assertConstructor('PackageError');
          throw new MismatchedNameError('package name is different with provided name');
        }
      }
    } else {
      const InvalidPackageError = errors.assertConstructor('PackageError');
      throw new InvalidPackageError('package.json file is not found or has invalid format');
    }
    return buf.packagePath;
  } catch (err) {
    issueInspector.collect({
      hasError: true,
      stage: 'bootstrap',
      type: pkgInfo.type,
      name: pkgInfo.name,
      stack: err.stack
    });
    return null;
  }
}

module.exports = global[constx.FRAMEWORK.NAME] = global[FRAMEWORK_CAPNAME] = bootstrap;
