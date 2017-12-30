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
	var app;
	describe('default configuration (without profile & sandbox)', function() {
		it('load application configuration', function() {
			var cfgLoader = new ConfigLoader('app', path.join(__dirname, '../lab/app-tdd-cfg'), [
				path.join(__dirname, '../lab/lib/plugin1'),
				path.join(__dirname, '../lab/lib/plugin2'),
				path.join(__dirname, '../..')
			]);

			true && console.log(JSON.stringify(cfgLoader.config, null, 2));

			assert.deepEqual(
				lodash.get(cfgLoader,"config.profile.default"),
				lodash.get(cfgLoader,"config.profile.staging")
			);

			assert.deepInclude(
				lodash.get(cfgLoader,"config.profile.default"),
				lodash.defaultsDeep(
					loader(path.join(__dirname, '../lab/app-tdd-cfg/config/profile.js')),
					loader(path.join(__dirname, '../../config/profile.js')),
					{}));

			assert.deepEqual(
				lodash.get(cfgLoader,"config.sandbox.default"),
				lodash.get(cfgLoader,"config.sandbox.staging.default")
			);

			assert.deepEqual(
				lodash.get(cfgLoader,"config.sandbox.default"),
				lodash.defaultsDeep(
					loader(path.join(__dirname, '../lab/app-tdd-cfg/config/sandbox.js')),
					loader(path.join(__dirname, '../lab/lib/plugin1/config/sandbox.js')),
					loader(path.join(__dirname, '../lab/lib/plugin2/config/sandbox.js')),
					loader(path.join(__dirname, '../../config/profile.js')),
					{}));
		});
	});
});
