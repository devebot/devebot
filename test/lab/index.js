var path = require('path');

module.exports = {
	getApp: function(name) {
		name = name || 'app';
		return require(path.join(__dirname, './' + name));
	},
	getDevebot: function() {
		return require(path.join(__dirname, '../../index'));
	}
}