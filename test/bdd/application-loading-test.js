'use strict';

var lab = require('../lab');
var Devebot = lab.getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('bdd:devebot:application-loading-test');
var assert = require('chai').assert;
var expect = require('chai').expect;
var LogTracer = require('logolite').LogTracer;

describe('devebot:application', function() {
	this.timeout(lab.getDefaultTimeout());

	var app;
	var logStats = {};

	before(function() {
		LogTracer.setupDefaultInterceptors([
			{
				accumulator: logStats,
				mappings: [
					{
						anyTags: [ 'devebot-metadata', 'logolite-metadata' ],
						storageField: 'metadata'
					},
					{
						anyTags: [ 'constructor-begin' ],
						counterField: 'constructorBeginTotal'
					},
					{
						anyTags: [ 'constructor-end' ],
						counterField: 'constructorEndTotal'
					}
				]
			}
		]);
	});

	beforeEach(function() {
		LogTracer.reset().empty(logStats);
	});

	it('total of constructor startpoints must equal to constructor endpoints', function(done) {
		app = lab.getApp();
		app.server.start()
			.then(function() {
				false && console.log(JSON.stringify(logStats, null, 2));
				assert.equal(logStats.constructorBeginTotal, logStats.constructorEndTotal);
				return true;
			})
			.then(function() {
				return app.server.teardown();
			})
			.then(function() {
				done();
			})
			.catch(function(err) {
				done(err);
			});
	});

	afterEach(function() {
		app = null;
	});

	after(function() {
		LogTracer.clearStringifyInterceptors();
	});
});
