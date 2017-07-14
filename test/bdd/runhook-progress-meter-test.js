'use strict';

var lab = require('../lab');
var Devebot = lab.getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debug = Devebot.require('debug');
var assert = require('chai').assert;
var expect = require('chai').expect;
var util = require('util');
var debugx = debug('bdd:devebot:runhook:progress:meter');
var DevebotApi = require('devebot-api');

describe('devebot:runhook:progress:meter', function() {
	this.timeout(lab.getDefaultTimeout());

	var app, api;

	before(function() {
		app = lab.getApp();
	});

	beforeEach(function(done) {
		app.server.start().then(function() {
			done();
		});
		api = new DevebotApi(lab.getApiConfig());
	});

	afterEach(function(done) {
		api = null;
		app.server.teardown().then(function() {
			done();
		});
	});

	it('direct runhook should return correct result', function(done) {
		var number = 15;
		var expectedValue = fibonacci(number);
		var expectedPrgr = [];
		lodash.range(number).map(function(n) {
			expectedPrgr.push(lodash.round((n + 1) * 100 / number));
		});
		var returnedPrgr = [];
		new Promise(function(resolved, rejected) {
			api.on('failure', function(result) {
				rejected(result);
			});
			api.on('success', function(result) {
				resolved(result);
			});
			api.on('progress', function(status) {
				returnedPrgr.push(status.progress);
			});
			api.execCommand({
				name: 'runhook-call',
				options: {
					name: 'plugin2-routine1',
					data: JSON.stringify({ 'number': number }),
					mode: 'direct'
				}
			});
		}).then(function(result) {
			debugx.enabled && debugx('Expected progress: %s', JSON.stringify(expectedPrgr));
			debugx.enabled && debugx('Returned progress: %s', JSON.stringify(returnedPrgr));
			assert.sameOrderedMembers(expectedPrgr, returnedPrgr);
			debugx.enabled && debugx(JSON.stringify(result, null, 2));
			assert.equal(result.details[0].data.fibonacci, expectedValue);
			done();
		}).catch(function(error) {
			debugx.enabled && debugx(JSON.stringify(error, null, 2));
			done(error);
		});
	});

	it('remote runhook should return correct result', function(done) {
		var number = 20;
		var expectedValue = fibonacci(number);
		var expectedPrgr = [];
		lodash.range(number).map(function(n) {
			expectedPrgr.push(lodash.round((n + 1) * 100 / number));
		});
		var returnedPrgr = [];
		new Promise(function(resolved, rejected) {
			api.on('failure', function(result) {
				rejected(result);
			});
			api.on('success', function(result) {
				resolved(result);
			});
			api.on('progress', function(status) {
				returnedPrgr.push(status.progress);
			});
			api.execCommand({
				name: 'runhook-call',
				options: {
					name: 'plugin2-routine1',
					data: JSON.stringify({ 'number': number }),
					mode: 'remote'
				}
			});
		}).then(function(result) {
			debugx.enabled && debugx('Expected progress: %s', JSON.stringify(expectedPrgr));
			debugx.enabled && debugx('Returned progress: %s', JSON.stringify(returnedPrgr));
			assert.sameOrderedMembers(expectedPrgr, returnedPrgr);
			debugx.enabled && debugx(JSON.stringify(result, null, 2));
			assert.equal(result.details[0].data.fibonacci, expectedValue);
			done();
		}).catch(function(error) {
			debugx.enabled && debugx(JSON.stringify(error, null, 2));
			done(error);
		});
	});

	it('return error when input data is invalid with schema', function(done) {
		var number = 101;
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
					name: 'plugin2-routine1',
					data: JSON.stringify({ 'number': number }),
					mode: 'remote'
				}
			});
		}).then(function(result) {
			debugx.enabled && debugx(JSON.stringify(result, null, 2));
			done();
		}).catch(function(error) {
			debugx.enabled && debugx(JSON.stringify(error, null, 2));
			assert.isObject(error.details[0].data.schema);
			assert.isString(error.details[0].data.message);
			done();
		});
	});

	it('return error when input data cannot pass validate()', function(done) {
		var number = 101;
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
					name: 'plugin2-routine3',
					data: JSON.stringify({ 'number': number }),
					mode: 'remote'
				}
			});
		}).then(function(result) {
			debugx.enabled && debugx(JSON.stringify(result, null, 2));
			done();
		}).catch(function(error) {
			debugx.enabled && debugx(JSON.stringify(error, null, 2));
			assert.isString(error.details[0].data.message);
			done();
		});
	});
});

var fibonacci = function fibonacci(n) {
  if (n == 0 || n == 1)
    return n;
  else
    return fibonacci(n - 1) + fibonacci(n - 2);
}
