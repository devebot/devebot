'use strict';

var lab = require('../lab');
var Devebot = lab.getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debug = Devebot.require('debug');
var assert = require('chai').assert;
var expect = require('chai').expect;
var util = require('util');
var debugx = debug('bdd:devebot:command:runhook:list');
var DevebotApi = require('devebot-api');

describe('devebot:command:runhook:list', function() {
	this.timeout(60000);
	var app, api;

	before(function() {
		app = lab.getApp();
		api = new DevebotApi(lab.getApiConfig());
	});

	beforeEach(function(done) {
		app.server.start().then(function() {
			done();
		});
	});

	afterEach(function(done) {
		app.server.teardown().then(function() {
			done();
		});
	});

	it('definition should contain runhook-list command', function(done) {
		return new Promise(function(resolved, rejected) {
			api.loadDefinition(function(err, defs) {
				if (err) return rejected(err);
				resolved(defs);
			});
		}).then(function(defs) {
			var cmd = lodash.keyBy(defs.commands, 'name')['runhook-list'];
			assert.isNotNull(cmd);
			done();
		});
	});

	it('invoked [runhook-list] command return list of active runhooks', function(done) {
		return new Promise(function(resolved, rejected) {
			api.on('failure', function(result) {
				rejected(result);
			});
			api.on('success', function(result) {
				resolved(result);
			});
			api.execCommand({
				name: 'runhook-list'
			});
		}).then(function(result) {
			debugx.enabled && debugx('Runhook list: %s', JSON.stringify(result, null, 2));
			done();
		}).catch(function(error) {
			debugx.enabled && debugx('Command error: %s', JSON.stringify(error, null, 2));
			done(error);
		});
	});
});
