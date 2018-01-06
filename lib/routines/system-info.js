'use strict';

var Promise = require('bluebird');
var lodash = require('lodash');
var os = require('os');

var commandConfig;

var commandObject = {
  info: {
    alias: 'sys-info',
    description: 'Display the system information (configuration, logger, sandbox)',
    options: []
  },
  handler: function(options, payload, ctx) {
    return Promise.resolve([{
      type: 'record',
      title: 'OS information',
      label: {
        os_platform: 'Platform',
        os_arch: 'Architecture',
        os_cpus: 'CPUs',
        os_hostname: 'Hostname',
        os_network_interface: 'Network',
        os_totalmem: 'Total memory (MB)',
        os_freemem: 'Free memory (MB)',
        os_loadavg: 'Load averages',
        os_uptime: 'System uptime (h)'
      },
      data: {
        os_platform: os.platform(),
        os_arch: os.arch(),
        os_cpus: lodash.map(os.cpus(), function(cpu) { 
          return lodash.pick(cpu, ['model', 'speed']);
        }),
        os_hostname: os.hostname(),
        os_network_interface: os.networkInterfaces(),
        os_totalmem: os.totalmem()/1024/1024,
        os_freemem: os.freemem()/1024/1024,
        os_loadavg: os.loadavg(),
        os_uptime: os.uptime()/3600
      }
    }]);
  }
};

module.exports = function(params) {
  commandConfig = params || {};
  return commandObject;
};
