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

describe('devebot:config:loader', function() {

	describe('default configuration (without profile & sandbox)', function() {
		it('load application configuration', function() {
			var cfgLoader = new ConfigLoader('app', null, lab.getAppHome('app-tdd-cfg'), [
				lab.getLibHome('plugin1'),
				lab.getLibHome('plugin2'),
				lab.getDevebotHome()
			]);

			true && console.log(JSON.stringify(cfgLoader.config, null, 2));

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

		var env_CONFIG_DIR = process.env.NODE_DEVEBOT_CONFIG_DIR;
		var env_CONFIG_ENV = process.env.NODE_DEVEBOT_CONFIG_ENV;

		before(function() {
			process.env.NODE_DEVEBOT_CONFIG_DIR = path.join(__dirname, '../lab/app-tdd-cfg/newcfg');
			process.env.NODE_DEVEBOT_CONFIG_ENV = 'dev';
		});

		it('load application configuration', function() {
			var cfgLoader = new ConfigLoader('app', null, lab.getAppHome('app-tdd-cfg'), [
				lab.getLibHome('plugin1'),
				lab.getLibHome('plugin2'),
				lab.getDevebotHome()
			]);

			true && console.log(JSON.stringify(cfgLoader.config, null, 2));

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
			process.env.NODE_DEVEBOT_CONFIG_DIR = env_CONFIG_DIR;
			process.env.NODE_DEVEBOT_CONFIG_ENV = env_CONFIG_ENV;
		});
	});
});
