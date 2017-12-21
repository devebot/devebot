'use strict';

var lab = require('../lab');
var Devebot = lab.getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('tdd:devebot:core:config:loader');
var assert = require('chai').assert;
var expect = require('chai').expect;
var path = require('path');
var util = require('util');
var CfgLoader = require('../../lib/backbone/config-loader');

describe('devebot:config:loader', function() {
	var app;
	describe('default configuration (without profile & sandbox)', function() {
		it('load application configuration', function() {
			var cfgLoader = new CfgLoader('app', path.join(__dirname, '../lab/app'), [
				path.join(__dirname, '../lab/lib/plugin1'),
				path.join(__dirname, '../lab/lib/plugin2'),
				path.join(__dirname, '../..')
			]);
			console.log(JSON.stringify(cfgLoader.config, null, 2));
		});
	});
});
