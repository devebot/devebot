var main = require('./index').getApp('app-simple');
main.runner.invoke(function(injektor) {
	console.log('profile config: %s', JSON.stringify(injektor.lookup('profileConfig'), null, 2));
	return Promise.resolve();
});
