'use strict';

var lab = require('../lab');
var Devebot = lab.getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('tdd:devebot:loggingFactory');
var assert = require('chai').assert;
var expect = require('chai').expect;
var path = require('path');
var util = require('util');
var LoggingFactory = require('../../lib/backbone/logging-factory');

describe('devebot:loggingFactory', function() {
	var app;
	describe('extend Tracer using branch() method', function() {
		it('default Tracer must contain framework information', function() {
			var factory = new LoggingFactory({
				logger: {
					transports: {
						console: {
							type: 'console',
							level: 'debug',
							json: false,
							timestamp: true,
							colorize: true
						}
					}
				}
			});

			var rootTracer = factory.getTracer();
			var logObject_1 = rootTracer.toMessage();
			
			console.log(logObject_1);
		});

		it('recursive branch() calls will return hierarchical loggingFactory objects', function() {
			var factory = new LoggingFactory({
				logger: {
					transports: {
						console: {
							type: 'console',
							level: 'debug',
							json: false,
							timestamp: true,
							colorize: true
						}
					}
				}
			});

			var childFactory1 = factory.branch('child1');
			var logObject_1 = childFactory1.getTracer().toMessage();
			assert.isTrue(factory.getTracer() !== childFactory1.getTracer());
			assert.isTrue(factory.getLogger() === childFactory1.getLogger());

			var childFactory2 = factory.branch('child2');
			var gchildFactory = childFactory2.branch('grand-children');
			var logObject_2_1 = gchildFactory.getTracer().toMessage();
			assert.isTrue(factory.getTracer() !== gchildFactory.getTracer());
			assert.isTrue(factory.getLogger() === gchildFactory.getLogger());

			console.log(logObject_2_1);
		});
	});
});
