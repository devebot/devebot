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
	var logCounter = LogTracer.countLogObject.bind(null, logStats, [
		{
			matchingField: 'checkpoint',
			filter: /plugin1-routine1-.*/g,
			storageField: 'plugin1Routine1Count'
		},
		{
			matchingField: 'checkpoint',
			filter: /plugin1-routine2-.*/g,
			storageField: 'plugin1Routine2Count'
		}
	]);
	var logExtractor = LogTracer.extractLogFields.bind(null, logStats, [
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
		app = lab.getApp();
		api = new DevebotApi(lab.getApiConfig());
		LogTracer.clearStringifyInterceptors();
		LogTracer.addStringifyInterceptor(logCounter);
		LogTracer.addStringifyInterceptor(logExtractor);
	});

	beforeEach(function(done) {
		LogTracer.reset();
		Object.keys(logStats).forEach(function(fieldName) {
			delete logStats[fieldName];
		});
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
			var cmd = lodash.keyBy(defs.commands, 'name')['runhook-call'];
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
				name: 'runhook-call',
				options: {
					name: 'plugin1-routine1',
					data: '{ "key": "hello", "value": "world" }'
				}
			});
		}).then(function(result) {
			debugx.enabled && debugx(JSON.stringify(result, null, 2));
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
			console.log(JSON.stringify(logStats));
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
				name: 'runhook-call',
				options: {
					name: 'plugin1-routine2',
					mode: 'direct',
					data: '{ "key": "hello", "value": "world" }'
				}
			});
		}).then(function(result) {
			debugx.enabled && debugx(JSON.stringify(result, null, 2));
			assert.equal(logStats['plugin1Routine2Count'], 3);
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
