'use strict';

var constx = {
  MIME_JSON: 'application/json',
  APPINFO: {
    FIELDS: ['version', 'name', 'description', 'homepage', 'author', 'license']
  },
  CONFIG: {
    MUST_SPECIFY_IN_ENV: true
  },
  JOB: {
    MSG_ON_EVENT: {
      'enqueue': '<%s> * JobEvent <%s>, to <%s>#<%s> the <%s> document',
      'enqueue_debug': '<%s> * JobEvent <%s>, to <%s>#<%s> the <%s> document <%s>, has been started with parameters: <%s>',
      'promotion': '<%s> * JobEvent <%s>, to <%s>#<%s> the <%s> document, is promoted (delayed to queued)',
      'promotion_debug': '<%s> * JobEvent <%s>, to <%s>#<%s> the <%s> document <%s>, has been promoted with parameters: <%s>',
      'progress': '<%s> + JobEvent <%s>, to <%s>#<%s> the <%s> document <%s>, has been  completed %s%%, with data: <%s>',
      'failed': '<%s> + JobEvent <%s>, to <%s>#<%s> the <%s> document <%s>, has been failed with error message <%s>',
      'complete': '<%s> + JobEvent <%s>, to <%s>#<%s> the <%s> document',
      'complete_debug': '<%s> + JobEvent <%s>, to <%s>#<%s> the <%s> document <%s>, has been completed with result <%s>',
      'remove': '<%s> * JobEvent <%s>, to <%s>#<%s> the <%s> document, is removed',
      'remove_debug': '<%s> * JobEvent <%s>, to <%s>#<%s> the <%s> document <%s>, has been removed: <%s>',
    }
  },
  COMMAND: {
    ROOT_KEY: 'command',
    SCRIPT_DIR: '/lib/scripts',
    SCHEMA: {
      OBJECT: {
        "type": "object",
        "properties": {
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
          }
        }
      }
    }
  },
  RUNHOOK: {
    ROOT_KEY: 'runhook',
    SCRIPT_DIR: '/lib/scripts',
    MSG: {
      BEGIN: '<%s> + Runhook <%s>, <%s>#<%s> an item of a <%s> document, starting',
      DATA: '<%s> - Runhook <%s>, <%s>#<%s> the item <%s> document: %s',
      RESULT: '<%s> - Runhook <%s>, <%s>#<%s> the item <%s> document, result: %s',
      ERROR: '<%s> - Runhook <%s>, <%s>#<%s> the item <%s> document <%s>, error: %s',
      END: '<%s> - Runhook <%s>, <%s>#<%s> the item <%s> document, finish',
      NOOP: '<%s> - Runhook <%s>, <%s>#<%s> the item <%s> document: operation is not defined'
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