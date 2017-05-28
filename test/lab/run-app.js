var main = require('./app/index');
main.server.tryit(function(injektor) {
	console.log('profile config: %s', JSON.stringify(injektor.lookup('profileConfig'), null, 2));
	return Promise.resolve();
});
