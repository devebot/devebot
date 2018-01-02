'use strict';

var lab = require('../lab');
var Devebot = lab.getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var loader = Devebot.require('loader');
var debugx = Devebot.require('pinbug')('tdd:devebot:core:config:loader');
var assert = require('chai').assert;
var expect = require('chai').expect;
var path = require('path');
var util = require('util');
var ConfigLoader = require('../../lib/backbone/config-loader');
var Envar = require('../lab/utils/envar');

describe('devebot:config:loader', function() {

	describe('default configuration (without profile & sandbox)', function() {
		it('load application configuration', function() {
			var cfgLoader = new ConfigLoader('app', null, lab.getAppHome('app-tdd-cfg'), [
				lab.getLibHome('plugin1'),
				lab.getLibHome('plugin2'),
				lab.getDevebotHome()
			]);

			false && console.log(JSON.stringify(cfgLoader.config, null, 2));

			assert.deepEqual(
				lodash.get(cfgLoader,"config.profile.default"),
				lodash.get(cfgLoader,"config.profile.staging")
			);

			assert.deepInclude(
				lodash.get(cfgLoader,"config.profile.default"),
				lodash.defaultsDeep(
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'config'), 'profile.js')),
					loader(path.join(lab.getDevebotCfgDir(), 'profile.js')),
					{}));

			assert.deepEqual(
				lodash.get(cfgLoader,"config.sandbox.default"),
				lodash.get(cfgLoader,"config.sandbox.staging")
			);

			assert.deepEqual(
				lodash.get(cfgLoader,"config.sandbox.default"),
				lodash.defaultsDeep(
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'config'), 'sandbox.js')),
					loader(path.join(lab.getLibCfgDir('plugin1'), 'sandbox.js')),
					loader(path.join(lab.getLibCfgDir('plugin2'), 'sandbox.js')),
					loader(path.join(lab.getDevebotCfgDir(), 'sandbox.js')),
					{}));
		});
	});

	describe('staging configuration', function() {
		var envar = new Envar();
		before(function() {
			envar.setup({
				NODE_DEVEBOT_CONFIG_DIR: path.join(__dirname, '../lab/app-tdd-cfg/newcfg'),
				NODE_DEVEBOT_CONFIG_ENV: 'dev'
			});
		});

		it('load application configuration (without customized profile, sandbox)', function() {
			var cfgLoader = new ConfigLoader('app', null, lab.getAppHome('app-tdd-cfg'), [
				lab.getLibHome('plugin1'),
				lab.getLibHome('plugin2'),
				lab.getDevebotHome()
			]);

			false && console.log(JSON.stringify(cfgLoader.config, null, 2));

			assert.deepEqual(
				lodash.get(cfgLoader,"config.profile.default"),
				lodash.get(cfgLoader,"config.profile.staging")
			);

			assert.deepInclude(
				lodash.get(cfgLoader,"config.profile.staging"),
				lodash.defaultsDeep(
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'profile.js')),
					loader(path.join(lab.getDevebotCfgDir(), 'profile.js')),
					{}));

			assert.deepEqual(
				lodash.get(cfgLoader,"config.sandbox.default"),
				lodash.get(cfgLoader,"config.sandbox.staging")
			);

			assert.deepEqual(
				lodash.get(cfgLoader,"config.sandbox.default"),
				lodash.defaultsDeep(
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox.js')),
					loader(path.join(lab.getLibCfgDir('plugin1'), 'sandbox.js')),
					loader(path.join(lab.getLibCfgDir('plugin2'), 'sandbox.js')),
					loader(path.join(lab.getDevebotCfgDir(), 'sandbox.js')),
					{}));
		});

		after(function() {
			envar.reset();
		});
	});

	describe('customize sandbox configuration', function() {
		var envar = new Envar();
		before(function() {
			envar.setup({
				NODE_DEVEBOT_CONFIG_DIR: path.join(__dirname, '../lab/app-tdd-cfg/newcfg'),
				NODE_DEVEBOT_CONFIG_ENV: 'dev',
				NODE_DEVEBOT_SANDBOX: 'ev1,ev2'
			});
		});

		it('load application configuration (without customized profile, sandbox)', function() {
			var cfgLoader = new ConfigLoader('app', null, lab.getAppHome('app-tdd-cfg'), [
				lab.getLibHome('plugin1'),
				lab.getLibHome('plugin2'),
				lab.getDevebotHome()
			]);

			false && console.log(JSON.stringify(cfgLoader.config, null, 2));

			assert.deepEqual(
				lodash.get(cfgLoader,"config.profile.staging"),
				lodash.get(cfgLoader,"config.profile.default")
			);

			assert.deepInclude(
				lodash.get(cfgLoader,"config.profile.staging"),
				lodash.defaultsDeep(
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'profile.js')),
					loader(path.join(lab.getDevebotCfgDir(), 'profile.js')),
					{}));

			assert.deepInclude(
				lodash.get(cfgLoader,"config.sandbox.staging"),
				lodash.assign(lodash.get(cfgLoader,"config.sandbox.default"), {
					"common": {
						"ev": 2,
						"ev1": [ "environment variable", 1 ],
						"ev2": [ "environment variable", 2 ],
						"name": "ev2"
					}
				})
			);

			assert.deepInclude(
				lodash.get(cfgLoader,"config.sandbox.staging"),
				lodash.defaultsDeep(
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox_ev2.js')),
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox_ev1.js')),
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox.js')),
					loader(path.join(lab.getLibCfgDir('plugin1'), 'sandbox.js')),
					loader(path.join(lab.getLibCfgDir('plugin2'), 'sandbox.js')),
					loader(path.join(lab.getDevebotCfgDir(), 'sandbox.js')),
					{}));
		});

		it('load application configuration with private sandboxes', function() {
			var cfgLoader = new ConfigLoader('app', {
				privateSandboxes: ['bs1', 'bs2']
			}, lab.getAppHome('app-tdd-cfg'), [
				lab.getLibHome('plugin1'),
				lab.getLibHome('plugin2'),
				lab.getDevebotHome()
			]);

			true && console.log(JSON.stringify(cfgLoader.config, null, 2));

			// Profile configuration
			assert.deepEqual(
				lodash.get(cfgLoader,"config.profile.staging"),
				lodash.get(cfgLoader,"config.profile.default")
			);

			assert.deepInclude(
				lodash.get(cfgLoader,"config.profile.staging"),
				lodash.defaultsDeep(
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'profile.js')),
					loader(path.join(lab.getDevebotCfgDir(), 'profile.js')),
					{}));

			// Sandbox configuration
			assert.deepInclude(
				lodash.get(cfgLoader,"config.sandbox.staging"),
				lodash.assign(lodash.get(cfgLoader,"config.sandbox.default"), {
					"common": {
						"bs": 2,
						"bs1": [ "bootstrap", 1 ],
						"bs2": [ "bootstrap", 2 ],
						"ev": 2,
						"ev1": [ "environment variable", 1 ],
						"ev2": [ "environment variable", 2 ],
						"name": "bs2"
					}
				})
			);

			assert.deepInclude(
				lodash.get(cfgLoader,"config.sandbox.staging"),
				lodash.defaultsDeep(
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox_bs2.js')),
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox_bs1.js')),
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox_ev2.js')),
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox_ev1.js')),
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox.js')),
					loader(path.join(lab.getLibCfgDir('plugin1'), 'sandbox.js')),
					loader(path.join(lab.getLibCfgDir('plugin2'), 'sandbox.js')),
					loader(path.join(lab.getDevebotCfgDir(), 'sandbox.js')),
					{}));
		});

		it('the order of listed sandbox labels is sensitive', function() {
			var cfgLoader = new ConfigLoader('app', {
				privateSandboxes: 'bs2, bs1'
			}, lab.getAppHome('app-tdd-cfg'), [
				lab.getLibHome('plugin1'),
				lab.getLibHome('plugin2'),
				lab.getDevebotHome()
			]);

			// Profile configuration
			assert.deepEqual(
				lodash.get(cfgLoader,"config.profile.staging"),
				lodash.get(cfgLoader,"config.profile.default")
			);

			assert.deepInclude(
				lodash.get(cfgLoader,"config.profile.staging"),
				lodash.defaultsDeep(
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'profile.js')),
					loader(path.join(lab.getDevebotCfgDir(), 'profile.js')),
					{}));

			// Sandbox configuration
			assert.deepInclude(
				lodash.get(cfgLoader,"config.sandbox.staging"),
				lodash.assign(lodash.get(cfgLoader,"config.sandbox.default"), {
					"common": {
						"bs": 1,
						"bs1": [ "bootstrap", 1 ],
						"bs2": [ "bootstrap", 2 ],
						"ev": 2,
						"ev1": [ "environment variable", 1 ],
						"ev2": [ "environment variable", 2 ],
						"name": "bs1"
					}
				})
			);

			assert.deepInclude(
				lodash.get(cfgLoader,"config.sandbox.staging"),
				lodash.defaultsDeep(
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox_bs1.js')),
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox_bs2.js')),
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox_ev2.js')),
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox_ev1.js')),
					loader(path.join(lab.getAppCfgDir('app-tdd-cfg', 'newcfg/dev'), 'sandbox.js')),
					loader(path.join(lab.getLibCfgDir('plugin1'), 'sandbox.js')),
					loader(path.join(lab.getLibCfgDir('plugin2'), 'sandbox.js')),
					loader(path.join(lab.getDevebotCfgDir(), 'sandbox.js')),
					{}));
		});

		after(function() {
			envar.reset();
		});
	});
});
