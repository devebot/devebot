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
    BACKUP_DATA: 'backup-data'
  },
  JOB: {
    MSG_ON_EVENT: {
      'enqueue': ' * <%s> - Job <%s>, to <%s> the <%s> document <%s>, has been started with parameters: <%s>',
      'progress': ' * <%s> - Job <%s>, to <%s> the <%s> document <%s>, has been  completed %s%%, with data: <%s>',
      'failed': ' * <%s> - Job <%s>, to <%s> the <%s> document <%s>, has been failed with error message <%s>',
      'complete': ' * <%s> - Job <%s>, to <%s> the <%s> document <%s>, has been completed with result <%s>'
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
      'BEGIN': ' - <%s> In <%s>, start to <%s> an item of <%s> document: %s',
      'RESULT': ' -> <%s> in <%s>, <%s> the item <%s> document <%s>, oplog result: %s',
      'ERROR': ' -> <%s> in <%s>, <%s> the item <%s> document <%s>, oplog error: %s',
      'END': ' -> <%s> in <%s>, finish to <%s> the item <%s> document: %s',
      'NOOP': ' -> <%s> in <%s>, operation <%s> on the item <%s> document: %s is not defined'
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