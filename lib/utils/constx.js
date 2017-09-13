'use strict';

var constx = {
  MIME_JSON: 'application/json',
  APPINFO: {
    FIELDS: ['version', 'name', 'description', 'homepage', 'author', 'license']
  },
  CONFIG: {
    MUST_SPECIFY_IN_ENV: true
  },
  COMMAND: {
    ROOT_KEY: 'command',
    SCRIPT_DIR: '/lib/commands',
    SCHEMA: {
      OBJECT: {
        "type": "object",
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "info": {
            "type": "object",
            "properties": {
              "description": {
                "type": "string"
              },
              "options": {
                "type": "array"
              }
            }
          },
          "handler": {}
        }
      }
    }
  },
  RUNHOOK: {
    ROOT_KEY: 'runhook',
    SCRIPT_DIR: '/lib/routines',
    SCHEMA: {
      OBJECT: {
        "type": "object",
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "info": {
            "type": "object",
            "properties": {
              "description": {
                "type": "string"
              },
              "schema": {
                "type": "object",
                "oneOf": [{
                  "$ref": "http://json-schema.org/draft-04/schema#"
                }]
              },
              "validate": {}
            }
          },
          "handler": {},
          "mode": {
            "type": "string",
            "enum": ["direct", "remote", "worker"]
          }
        }
      }
    }
  },
  SERVICE: {
    ROOT_KEY: 'service',
    SCRIPT_DIR: '/lib/services'
  },
  TRIGGER: {
    ROOT_KEY: 'trigger',
    SCRIPT_DIR: '/lib/triggers'
  },
  WEBSOCKET: {
    STATE: {
      STARTED: 'enqueue',
      PROMOTION: 'promotion',
      PROGRESS: 'progress',
      FAILURE: 'failed',
      SUCCESS: 'complete',
      REMOVE: 'remove',
      DONE: 'done'
    },
    MSG_ON: {
      STARTED: 'The command is started',
      PROMOTION: 'The command is promoted',
      PROGRESS: 'The command is processing ...',
      FAILURE: 'The command execution is failed',
      SUCCESS: 'The command execution is completed',
      REMOVE: 'The command is removed',
      DONE: 'The command is done'
    },
    DETAILS: {
      SCHEMA: {
        "type": "array",
        "items": {
          "oneOf": [{
            "properties": {
              "type": {
                "type": "string",
                "enum": ["json"]
              },
              "title": {
                "type": "string"
              },
              "data": {
                "type": ["boolean", "number", "string", "array", "object"]
              }
            },
            "required": ["type", "data"]
          }, {
            "properties": {
              "type": {
                "type": "string",
                "enum": ["record", "object"]
              },
              "title": {
                "type": "string"
              },
              "label": {
                "type": "object"
              },
              "data": {
                "type": "object"
              }
            },
            "required": ["type", "label", "data"]
          }, {
            "properties": {
              "type": {
                "type": "string",
                "enum": ["table", "grid"]
              },
              "title": {
                "type": "string"
              },
              "label": {
                "type": "object"
              },
              "data": {
                "type": "array",
                "minItems": 1,
                "items": {
                  "type": "object"
                }
              }
            },
            "required": ["type", "label", "data"]
          }]
        }
      }
    }
  }
};

module.exports = constx;