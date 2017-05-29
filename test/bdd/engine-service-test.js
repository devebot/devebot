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
	var app;
	describe('start/stop app engine-service', function() {
		before(function() {
			app = lab.getApp();
		});

		it('engine-service should be started/stopped properly', function(done) {
			Promise.resolve(app.server.start()).delay(4000).then(function() {
				return Promise.resolve(app.server.teardown()).delay(1000);
			}).then(function() {
				done();
			});
			this.timeout(6000);
		});
	});
});
