'use strict';

var lab = require('../lab');
var Devebot = lab.getDevebot();
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('bdd:devebot:core:configuration');
var assert = require('chai').assert;
var expect = require('chai').expect;
var util = require('util');
var DevebotApi = require('devebot-api');

describe('devebot:command:definition', function() {
	this.timeout(lab.getDefaultTimeout());

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

	it('definition should contain default commands', function(done) {
		new Promise(function(resolved, rejected) {
			api.loadDefinition(function(err, defs) {
				if (err) return rejected(err);
				resolved(defs);
			});
		}).then(function(defs) {
			var cmdNames = lodash.map(defs.commands, function(cmd) {
				return cmd.name;
			});

			var fwCmdNames = [
				'applica-info',
				'logger-info', 'logger-reset', 'logger-set',
				'sandbox-info', 'system-info'
			];
			assert.includeMembers(cmdNames, fwCmdNames);

			var appCmdNames = [
				'main-cmd1', 'main-cmd2'
			];
			assert.includeMembers(cmdNames, appCmdNames);

			assert(cmdNames.length >= fwCmdNames.length + appCmdNames.length);

			lodash.forEach(defs.commands, function(cmd) {
				assert.containsAllKeys(cmd, ['name', 'description', 'options']);
			});
			false && console.log('Definition: %s', JSON.stringify(defs, null, 2));

			done();
		});
	});
});
