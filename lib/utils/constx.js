'use strict';

var constx = {
  MIME_JSON: 'application/json',
  APPINFO: {
    FIELDS: ['version', 'name', 'description', 'homepage', 'author', 'license']
  },
  CMDSET: {
    SYSTEM_INFO: 'sysinfo',
    SANDBOX_INFO: 'sb-info',
    SANDBOX_USE: 'sb-use',
    ES_INFO: 'es-info',
    ES_CLEAR: 'es-clear',
    ES_RESET: 'es-reset',
    ES_INDEX_ALL: 'es-index-all',
    ES_INDEX_ENTITY: 'es-index-entity',
    ES_INDEX_ONE: 'es-index-one',
    RANDOM_DATA: 'random-data',
    BACKUP_DATA: 'backup-data',
    LOG_CHANGE_LEVEL: 'log-level',
    LOG_RESET_LEVELS: 'log-reset'
  },
  JOB: {
    MSG_ON_EVENT: {
      'enqueue': '<%s> * JobEvent <%s>, to <%s>#<%s> the <%s> document',
      'enqueue_debug': '<%s> * JobEvent <%s>, to <%s>#<%s> the <%s> document <%s>, has been started with parameters: <%s>',
      'progress': '<%s> + JobEvent <%s>, to <%s>#<%s> the <%s> document <%s>, has been  completed %s%%, with data: <%s>',
      'failed': '<%s> + JobEvent <%s>, to <%s>#<%s> the <%s> document <%s>, has been failed with error message <%s>',
      'complete': '<%s> + JobEvent <%s>, to <%s>#<%s> the <%s> document',
      'complete_debug': '<%s> + JobEvent <%s>, to <%s>#<%s> the <%s> document <%s>, has been completed with result <%s>'
    }
  },
  RUNHOOK: {
    ROOT_KEY: 'runhook',
    KEY: {
      MARKUP: 'index',
      MOCKIT: 'mockit',
      OPLOG: 'oplog'
    },
    ENTITY: {
      GLOBAL: '#global#'
    },
    MSG: {
      BEGIN: '<%s> + Runhook <%s>, <%s>#<%s> an item of a <%s> document, starting',
      DATA: '<%s> - Runhook <%s>, <%s>#<%s> the item <%s> document: %s',
      RESULT: '<%s> - Runhook <%s>, <%s>#<%s> the item <%s> document, result: %s',
      ERROR: '<%s> - Runhook <%s>, <%s>#<%s> the item <%s> document <%s>, error: %s',
      END: '<%s> - Runhook <%s>, <%s>#<%s> the item <%s> document, finish',
      NOOP: '<%s> - Runhook <%s>, <%s>#<%s> the item <%s> document: operation is not defined'
    }
  },
  WEBSOCKET: {
    STATE: {
      STARTED: 'enqueue',
      PROGRESS: 'progress',
      FAILURE: 'failed',
      SUCCESS: 'complete',
      DONE: 'done'
    },
    MSG_ON: {
      STARTED: 'The command is started',
      PROGRESS: 'The command is processing ...',
      FAILURE: 'The command execution is failed',
      SUCCESS: 'The command execution is completed',
      DONE: 'The command is done'
    }
  }
};

module.exports = constx;