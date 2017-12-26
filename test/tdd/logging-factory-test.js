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
	describe('extend Tracer using branch() method', function() {

		var env_DEBUGLOG = process.env.LOGOLITE_DEBUGLOG;
		var env_MOCKLOGGER_ENABLED = process.env.LOGOLITE_MOCKLOGGER_ENABLED;

		before(function() {
			process.env.LOGOLITE_DEBUGLOG = null;
			process.env.LOGOLITE_MOCKLOGGER_ENABLED = 'true';
		});

		beforeEach(function() {
			LoggingFactory.reset();
		});

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

			var mockLogger = factory.getLogger({ type: 'shadow' });
			var queue = mockLogger._probe();
			mockLogger._reset();

			assert.equal(queue.length, 2);
			queue.forEach(function(item) {
				item.payload = JSON.parse(item.payload);
			});
			assert.equal(lodash.get(queue, [1, 'payload', 'blockName']), 'devebot');

			var logObject_1 = rootTracer.toMessage();
			assert.deepEqual(
				lodash.pick(JSON.parse(logObject_1), ['instanceId', 'blockId']),
				lodash.pick(lodash.get(queue, [1, 'payload']), ['instanceId', 'blockId'])
			);
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
			var childFactory2 = factory.branch('child2');
			var factory_2_1 = childFactory2.branch('grand-child-1');
			var factory_2_2 = childFactory2.branch('grand-child-2');

			var logObject_1 = childFactory1.getTracer().toMessage();

			var mockLogger = factory.getLogger({ type: 'shadow' });
			var queue = mockLogger._probe();
			mockLogger._reset();

			assert.equal(queue.length, 5);
			queue.forEach(function(item) {
				item.payload = JSON.parse(item.payload);
			});

			var logObject_2 = childFactory2.getTracer().toMessage();
			var logObject_2_1 = factory_2_1.getTracer().toMessage();
			var logObject_2_2 = factory_2_2.getTracer().toMessage();

			assert.isTrue(factory.getLogger() === factory.getLogger());
			assert.isTrue(factory.getTracer() === factory.getTracer());

			assert.isTrue(factory.getTracer() !== childFactory1.getTracer());
			assert.isTrue(factory.getLogger() !== childFactory1.getLogger());
			assert.isTrue(factory.getTracer() !== factory_2_1.getTracer());
			assert.isTrue(factory.getLogger() !== factory_2_1.getLogger());

			assert.equal(lodash.get(queue, [0, 'payload', 'blockName']), 'devebot');
			assert.equal(lodash.get(queue, [1, 'payload', 'blockName']), 'child1');
			assert.equal(lodash.get(queue, [2, 'payload', 'blockName']), 'child2');
			assert.equal(lodash.get(queue, [3, 'payload', 'blockName']), 'grand-child-1');
			assert.equal(lodash.get(queue, [4, 'payload', 'blockName']), 'grand-child-2');

			assert.deepEqual(
				lodash.pick(JSON.parse(logObject_1), ['instanceId', 'blockId']),
				lodash.pick(lodash.get(queue, [1, 'payload']), ['instanceId', 'blockId'])
			);

			assert.deepEqual(
				lodash.pick(JSON.parse(logObject_2), ['instanceId', 'blockId']),
				lodash.pick(lodash.get(queue, [2, 'payload']), ['instanceId', 'blockId'])
			);
		});

		after(function() {
			process.env.LOGOLITE_DEBUGLOG = env_DEBUGLOG;
			process.env.LOGOLITE_MOCKLOGGER_ENABLED = env_MOCKLOGGER_ENABLED;
		});
	});
});
