'use strict';

var Devebot = require('../index').getDevebot();

var app = Devebot.launchApplication({
  appRootPath: __dirname
}, [
	{
		name: 'plugin1',
		path: __dirname + '/../lib/plugin1'
	},
	{
		name: 'plugin2',
		path: __dirname + '/../lib/plugin2'
	}
], [
	{
		name: 'bridge1',
		path: __dirname + '/../lib/bridge1'
	},
	{
		name: 'bridge2',
		path: __dirname + '/../lib/bridge2'
	}
]);

if (require.main === module) app.server.start();

module.exports = app;
