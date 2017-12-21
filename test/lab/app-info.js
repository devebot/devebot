'use strict';

var argv = require('minimist')(process.argv.slice(2));

var appName = argv['app'] || argv['a'] || 'app-simple';

var main = require('./index').getApp(appName);
main.runner.invoke(function(injektor) {
	console.log('profile config: %s', JSON.stringify(injektor.lookup('profileConfig'), null, 2));
	return Promise.resolve();
});
