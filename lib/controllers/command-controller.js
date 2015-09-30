'use strict';

var lodash = require('lodash');

var JobqueueAdapter = require('../services/jobqueue-adapter.js');
var MongodbTrigger = require('../triggers/mongodb-trigger.js');

function init(params) {
  
  //var jobqueueAdapter = new JobqueueAdapter(params);
  
  var mongodbTrigger = new MongodbTrigger(params);
  mongodbTrigger.start();
  
  var controller = {};
  
  controller.getDefinition = function(req, res) {
    var clidef = {
      appinfo: {
        name: 'devebot',
        description: 'development support toolkit',
        version: '0.0.1'
      },
      commands: [
        {
          name: 'random-data',
          description: 'Random data for the Application',
          options: [
            {
              abbr: 'm',
              name: 'mode',
              description: 'append|override - default is override',
              required: false
            }
          ]
        },
        {
          name: 'init-es',
          description: 'Initialize data for Elastic Search',
          options: [
            {
              abbr: 'h',
              name: 'host',
              description: 'Elasticsearch server host',
              required: true
            },
            {
              abbr: 'p',
              name: 'port',
              description: 'Elasticsearch server port',
              required: false
            }
          ]
        },
        {
          name: 'define-es',
          description: 'Defines Elastic Search structure',
          options: [
            {
              abbr: 'h',
              name: 'host',
              description: 'Elasticsearch server host',
              required: true
            },
            {
              abbr: 'p',
              name: 'port',
              description: 'Elasticsearch server port',
              required: false
            },
            {
              abbr: 'n',
              name: 'number',
              description: 'Total number of something',
              required: false
            }
          ]
        },
      ]
    };
    res.status(200).send(clidef);
  };
  
  controller.postCommand = function(req, res) {
    var cmd = req.body || {};
    if (lodash.isString(cmd)) {
      cmd = JSON.parse(cmd);
    }
    
    res.status(200).send({echo: cmd});
  };
  
  return controller;
}

module.exports = init;