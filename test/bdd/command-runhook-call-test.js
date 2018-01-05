'use strict';

var lab = require('../lab');
var Devebot = lab.getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('bdd:devebot:command:runhook:call');
var assert = require('chai').assert;
var expect = require('chai').expect;
var util = require('util');
var DevebotApi = require('devebot-api');
var LogTracer = require('logolite').LogTracer;

describe('devebot:command:runhook:call', function() {
	this.timeout(lab.getDefaultTimeout());

	var app, api;

	var logStats = {};
	var logCounter = LogTracer.accumulationAppender.bind(null, logStats, [
		{
			matchingField: 'checkpoint',
			filter: /plugin1-routine1-.*/g,
			counterField: 'plugin1Routine1Count'
		},
		{
			matchingField: 'checkpoint',
			filter: /plugin1-routine2-.*/g,
			counterField: 'plugin1Routine2Count'
		}
	]);
	var logScraper = LogTracer.accumulationAppender.bind(null, logStats, [
		{
			anyTags: [ 'logolite-metadata', 'devebot-metadata' ],
			storageField: 'blockLoggingState'
		},
		{
			matchingField: 'checkpoint',
			filter: 'plugin1-routine1-injected-names',
			selectedFields: ['injectedServiceNames', 'blockId', 'instanceId'],
			storageField: 'plugin1Routine1State'
		},
		{
			matchingField: 'checkpoint',
			filter: 'plugin1-routine2-injected-names',
			selectedFields: ['injectedServiceNames', 'blockId', 'instanceId'],
			storageField: 'plugin1Routine2State'
		}
	]);

	before(function() {
		LogTracer.clearStringifyInterceptors();
		LogTracer.addStringifyInterceptor(logCounter);
		LogTracer.addStringifyInterceptor(logScraper);
		app = lab.getApp();
		api = new DevebotApi(lab.getApiConfig());
	});

	beforeEach(function(done) {
		LogTracer.reset().empty(logStats);
		app.server.start().then(function() {
			done();
		});
	});

	afterEach(function(done) {
		app.server.teardown().then(function() {
			done();
		});
	});

	it('definition should contain runhook-call command', function(done) {
		new Promise(function(resolved, rejected) {
			api.loadDefinition(function(err, defs) {
				if (err) return rejected(err);
				resolved(defs);
			});
		}).then(function(defs) {
			var cmd = lodash.keyBy(defs.commands, 'name')['plugin1-routine1'];
			assert.isNotNull(cmd);
			done();
		});
	});

	it('remote runhook should return correct result', function(done) {
		new Promise(function(resolved, rejected) {
			api.on('failure', function(result) {
				rejected(result);
			});
			api.on('success', function(result) {
				resolved(result);
			});
			api.execCommand({
				name: 'plugin1-routine1',
				options: {},
				data: { "key": "hello", "value": "world" }
			});
		}).then(function(result) {
			debugx.enabled && debugx(JSON.stringify(result, null, 2));
			assert.equal(logStats['plugin1Routine1Count'], 3);
			assert.isArray(logStats['plugin1Routine1State']);
			assert.equal(logStats['plugin1Routine1State'].length, 1);
			assert.sameMembers(logStats['plugin1Routine1State'][0]['injectedServiceNames'], [
				"demo-app/mainService",
				"plugin1/plugin1Service",
				"plugin2/plugin2Service",
				"bridge1/anyname1a",
				"bridge1/anyname1b",
				"bridge2/anyname2a",
				"bridge2/anyname2b",
				"bridge2/anyname2c"
			]);
			done();
		}).catch(function(error) {
			debugx.enabled && debugx(JSON.stringify(error, null, 2));
			done(error);
		});
	});

	it('direct runhook should return correct result', function(done) {
		new Promise(function(resolved, rejected) {
			api.on('failure', function(result) {
				rejected(result);
			});
			api.on('success', function(result) {
				resolved(result);
			});
			api.execCommand({
				name: 'plugin1-routine2',
				data: { "key": "hello", "value": "world" }
			});
		}).then(function(result) {
			debugx.enabled && debugx(JSON.stringify(result, null, 2));
			assert.equal(logStats['plugin1Routine2Count'], 3);
			assert.isArray(logStats['plugin1Routine2State']);
			assert.equal(logStats['plugin1Routine2State'].length, 1);
			assert.sameMembers(logStats['plugin1Routine2State'][0]['injectedServiceNames'], [
				"demo-app/mainService",
				"plugin1/plugin1Service",
				"plugin2/plugin2Service",
				"bridge1/anyname1a",
				"bridge1/anyname1b",
				"bridge2/anyname2a",
				"bridge2/anyname2b",
				"bridge2/anyname2c"
			]);
			done();
		}).catch(function(error) {
			debugx.enabled && debugx(JSON.stringify(error, null, 2));
			done(error);
		});
	});

	after(function() {
		LogTracer.clearStringifyInterceptors();
	});
});
