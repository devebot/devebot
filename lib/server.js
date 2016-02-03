'use strict';

var lodash = require('lodash');
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var WebSocketServer = require('ws').Server;

var CommandController = require('./controllers/command-controller.js');

var logger = require('logdapter').defaultLogger;

var NODE_ENV = process.env.NODE_DEVEBOT_ENV || process.env.NODE_ENV;

function init(params) {
  // init the default parameters
  params = params || {};

  // Create our Express application
  var app = express();
  
  app.use(session({ 
    secret: '5upersecr3tk3yf0rd3v3b0t',
    saveUninitialized: true,
    resave: true
  }));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  app.use('*', function(req, res, next) {
    if (NODE_ENV && NODE_ENV != 'production') {
      process.nextTick(function() {
        logger.trace('=@ devebot service receives a new request:');
        logger.trace(' - Request protocol: ' + req.protocol);
        logger.trace(' - Request host: ' + req.hostname);
        logger.trace(' - Request body: ' + JSON.stringify(req.body));
        logger.trace(' - Request user-agent: ' + req.headers['user-agent']);
      });
   }
   next();
  });
  
  // Create commandController object
  var commandController = CommandController(params);
  
  // Create our Express router
  var router = express.Router();
  router.route('/devebot/clidef').get(commandController.getDefinition);
  router.route('/devebot/runner').post(commandController.postCommand);
  app.use(router);
  
  // wrapping Express Application by a HttpServer
  var server = http.createServer(app);

  server.start = function() {
    var serverPort = lodash.get(params, 'profile.default.devebot.port', 17779);
    var serverInstance = server.listen(serverPort, function () {
      var host = serverInstance.address().address;
      var port = serverInstance.address().port;
      console.log('devebot service listening at http://%s:%s', host, port);
      commandController.startDaemons();
    });
    return serverInstance;
  };

  var wss = new WebSocketServer({ 
    server: server,
    path: '/devebot/execute'
  });
  
  wss.on('connection', function connection(ws) {
    ws.on('open', function handler() {
      logger.trace(' - Websocket@server is opened');
    });
    
    ws.on('message', function incoming(data) {
      logger.trace(' - Websocket@server is received a message data: <%s>', data);
      commandController.executeCommand(data, ws);
    });
    
    ws.on('close', function handler(code, message) {
      logger.trace(' - Websocket@server is closed, code: <%s>, message: <%s>', code, message);
    });
    
    ws.on('error', function handler(error) {
      logger.trace(' - Websocket@server encounter an error: <%s>', error);
    });
  });
  
  wss.on('error', function connection(error) {
    logger.error(' - Websocket@server has an error: <%s>', JSON.stringify(error));
  });
  
  return server;
}

module.exports = init;
