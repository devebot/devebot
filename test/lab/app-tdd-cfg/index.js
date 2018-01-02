'use strict';

var Devebot = require('../index').getDevebot();

var app = Devebot.launchApplication({
  appRootPath: __dirname
}, [], []);

if (require.main === module) app.server.start();

module.exports = app;
