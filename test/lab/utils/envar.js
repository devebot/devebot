'use strict';

var lodash = require('lodash');

module.exports = function(kwargs) {

	var _store = {};

	this.setup = function(vars) {
		vars = vars || {};
		lodash.forEach(lodash.keys(vars), function(key) {
			if (_store[key] == undefined) {
				_store[key] = process.env[key];
			}
			process.env[key] = vars[key];
		});
		return this;
	}

	this.reset = function() {
		lodash.forEach(lodash.keys(_store), function(key) {
			process.env[key] = _store[key];
			delete _store[key];
		});
		return this;
	}

	return this.setup(kwargs);
}
