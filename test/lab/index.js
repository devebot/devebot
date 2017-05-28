module.exports = {
	getApp: function(name) {
		name = name || 'app';
		return require('./' + name);
	},
	getDevebot: function() {
		return require('../../index');
	}
}