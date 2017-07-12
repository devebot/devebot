var main = require('./app/index');
main.runner.invoke(function(injektor) {
	console.log('profile config: %s', JSON.stringify(injektor.lookup('profileConfig'), null, 2));
	return Promise.resolve();
});
