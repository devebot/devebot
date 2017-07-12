var lodash = require('lodash');
var path = require('path');

module.exports = {
	getApp: function(name) {
		name = name || 'app';
		return require(path.join(__dirname, './' + name));
	},
	getApiConfig: function(ext) {
		ext = ext || {};
		return lodash.merge({
			host: '127.0.0.1',
			port: 17779,
			path: '/demo-app',
			authen: {
				token_key: 'devebot',
				token_secret: 's3cr3tpa$$w0rd'
			}
		}, ext);
	},
	getDevebot: function() {
		return require(path.join(__dirname, '../../index'));
	}
}