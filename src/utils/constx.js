'use strict';

let constx = {
  MIME_JSON: 'application/json',
  APPINFO: {
    FIELDS: ['version', 'name', 'description', 'homepage', 'author', 'license']
  },
  CONFIG: {
    MUST_SPECIFY_IN_ENV: true
  },
  LOGGER: {
    LABELS: {
      silly: {
        level: 5,
        color: 'magenta'
      },
      debug: {
        level: 4,
        color: 'blue'
      },
      trace: {
        level: 3,
        color: 'cyan'
      },
      info: {
        level: 2,
        color: 'green'
      },
      warn: {
        level: 1,
        color: 'yellow'
      },
      error: {
        level: 0,
        color: 'red'
      }
    }
  },
  TRACER: {
    SECTOR: {
      ID_FIELD: 'blockId',
      NAME_FIELD: 'blockName'
    }
  },
  METAINF: {
    ROOT_KEY: 'metainf',
    SCRIPT_DIR: '/lib/metadata',
    SCHEMA_OBJECT: {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean"
        },
        "type": {
          "type": "string"
        },
        "subtype": {
          "type": "string"
        },
        "schema": {
          "type": "object",
          "oneOf": [
            {
              "$ref": "http://json-schema.org/draft-04/schema#"
            }
          ]
        }
      }
    }
  },
  ROUTINE: {
    ROOT_KEY: 'routine',
    SCRIPT_DIR: '/lib/routines',
    SCHEMA_OBJECT: {
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
  },
  FEATURE_ENABLED: [ 'presets', 'bridge-full-ref', 'standardizing-config', 'gadget-around-log' ]
};

module.exports = constx;