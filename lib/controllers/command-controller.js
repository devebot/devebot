'use strict';

var lodash = require('lodash');

var appinfoLoader = require('../services/appinfo-loader.js');
var ContextManager = require('../services/context-manager.js');
var ServiceManager = require('../services/service-manager.js');
var JobqueueAdapter = require('../services/jobqueue-adapter.js');
var MongodbTrigger = require('../triggers/mongodb-trigger.js');

var constx = require('../utils/constx.js');

function init(params) {
  
  var appinfo = appinfoLoader(params.appRootPath);
  
  var contextManager = new ContextManager({
    configuration: params.SERVER
  });
  
  var serviceManager = new ServiceManager({
    configuration: params.SERVER
  });
  
  var jobqueueAdapter = new JobqueueAdapter({
    configuration: params.SERVER
  });
  
  var mongodbTrigger = new MongodbTrigger({
    configuration: params.SERVER,
    jobqueueAdapter: jobqueueAdapter
  });
  mongodbTrigger.start();
  
  var controller = {};
  
  controller.getDefinition = function(req, res) {
    var clidef = {
      appinfo: appinfo,
      commands: [
        {
          name: constx.CMDSET.RANDOM_DATA,
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

    switch(cmd.command) {
      case constx.CMDSET.RANDOM_DATA: 
        jobqueueAdapter.enqueueJob(constx.RUNHOOK.KEY.MOCKIT, '#global#', 'randomize', {});
        break;
    }

    res.status(200).send({echo: cmd});
  };
  
  return controller;
}

module.exports = init;