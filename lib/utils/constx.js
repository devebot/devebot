'use strict';

var constx = {
  MIME_JSON: 'application/json',
  APPINFO: {
    FIELDS: ['version', 'name', 'description', 'homepage', 'author', 'license']
  },
  CONFIG: {
    MUST_SPECIFY_IN_ENV: true
  },
  LOGGER: {
    LEVELS: {
      silly: 5,
      debug: 4,
      trace: 3,
      info: 2,
      warn: 1,
      error: 0
    },
    COLORS: {
      silly: 'magenta',
      debug: 'blue',
      trace: 'cyan',
      info: 'green',
      warn: 'yellow',
      error: 'red'
    }
  },
  ROUTINE: {
    ROOT_KEY: 'routine',
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
              "options": {
                "type": "array"
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
      ERROR: 'error',
      STARTED: 'started',
      PROGRESS: 'progress',
      TIMEOUT: 'timeout',
      FAILED: 'failed',
      CANCELLED: 'cancelled',
      COMPLETED: 'completed',
      DONE: 'done'
    },
    MSG_ON: {
      ERROR: 'Invalid command object',
      STARTED: 'The command is started',
      PROGRESS: 'The command is processing ...',
      TIMEOUT: 'The command execution is timeout',
      FAILED: 'The command execution is failed',
      CANCELLED: 'The command is cancelled',
      COMPLETED: 'The command execution is completed',
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