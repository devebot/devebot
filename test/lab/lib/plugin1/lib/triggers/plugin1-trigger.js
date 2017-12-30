'use strict';

var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('devebot:test:lab:plugin1:plugin1Trigger');
var http = require('http');

var Service = function(params) {
  var self = this;
  params = params || {};

  debugx.enabled && debugx(' + constructor begin ...');

  var pluginCfg = lodash.get(params, ['sandboxConfig', 'plugins', 'plugin1'], {});

  var server = http.createServer();

  server.on('error', function(err) {
    debugx.enabled && debugx('Server Error: %s', JSON.stringify(err));
  });

  self.getServer = function() {
    return server;
  };

  var configHost = lodash.get(pluginCfg, 'host', '0.0.0.0');
  var configPort = lodash.get(pluginCfg, 'port', 8080);

  self.start = function() {
    return new Promise(function(resolved, rejected) {
      var serverInstance = server.listen(configPort, configHost, function () {
        var host = serverInstance.address().address;
        var port = serverInstance.address().port;
        (pluginCfg && pluginCfg.verbose !== false || debugx.enabled) &&
        console.log('plugin1 webserver is listening at http://%s:%s', host, port);
        resolved(serverInstance);
      });
    });
  };

  self.stop = function() {
    return new Promise(function(resolved, rejected) {
      server.close(function () {
        (pluginCfg && pluginCfg.verbose !== false || debugx.enabled) &&
        console.log('plugin1 webserver has been closed');
        resolved();
      });
    });
  };

  debugx.enabled && debugx(' - constructor end!');
};

Service.argumentSchema = {
  "id": "plugin1Trigger",
  "type": "object",
  "properties": {
    "sandboxName": {
      "type": "string"
    },
    "sandboxConfig": {
      "type": "object"
    },
    "profileConfig": {
      "type": "object"
    },
    "loggingFactory": {
      "type": "object"
    }
  }
};

module.exports = Service;
