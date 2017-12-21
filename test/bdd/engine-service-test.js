'use strict';

var lab = require('../lab');
var Devebot = lab.getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('bdd:devebot:engine:service');
var assert = require('chai').assert;
var expect = require('chai').expect;
var util = require('util');

describe('devebot:engine:server', function() {
	this.timeout(lab.getDefaultTimeout());
	var app;
	describe('start/stop app engine-service', function() {
		it('engine-service should be started/stopped properly', function(done) {
			app = lab.getApp();
			debugx.enabled && debugx('server.start()');
			app.server.start().then(function() {
				debugx.enabled && debugx('server.start() has done, teardown()');
				return app.server.teardown();
			}).then(function() {
				debugx.enabled && debugx('server.teardown() has done');
				done();
			});
		});
	});
});
