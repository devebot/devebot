'use strict';

var lab = require('../lab');
var Devebot = require('../lab/index').getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debug = Devebot.require('debug');
var assert = require('chai').assert;
var expect = require('chai').expect;
var util = require('util');
var debugx = debug('devebot:test:bdd:engine:service');

describe('devebot:engine:server', function() {
	this.timeout(lab.getDefaultTimeout());
	var app;
	describe('start/stop app engine-service', function() {
		it('engine-service should be started/stopped properly', function(done) {
			app = lab.getApp();
			app.server.start().then(function() {
				return app.server.teardown();
			}).then(function() {
				done();
			});
			this.timeout(6000);
		});
	});
});
