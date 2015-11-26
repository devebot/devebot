'use strict';

var constx = {
  MIME_JSON: 'application/json',
  APPINFO: {
    FIELDS: ['version', 'name', 'description', 'homepage', 'author', 'license']
  },
  CMDSET: {
    SYSTEM_INFO: 'system-info',
    ES_CLEAR: 'drop-es',
    ES_RESET: 'init-es',
    ES_INDEX_ALL: 'index-all',
    ES_INDEX_ENTITY: 'index-entity',
    ES_INDEX_ONE: 'index-one',
    RANDOM_DATA: 'random-data',
    BACKUP_DATA: 'backup-data'
  },
  JOB: {
    MSG_ON_EVENT: {
      'enqueue': 'Job <%s>, to <%s> the <%s> document <%s>, has been started with parameters: <%s>',
      'progress': 'Job <%s>, to <%s> the <%s> document <%s>, has been  completed %s%%, with data: <%s>',
      'failed': 'Job <%s>, to <%s> the <%s> document <%s>, has been failed with error message <%s>',
      'complete': 'Job <%s>, to <%s> the <%s> document <%s>, has been completed with result <%s>'
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
      'BEGIN': ' - In <%s>, start to <%s> an item of <%s> document: %s',
      'RESULT': ' -> in <%s>, <%s> the item <%s> document <%s>, oplog result: %s',
      'ERROR': ' -> in <%s>, <%s> the item <%s> document <%s>, oplog error: %s',
      'END': ' -> in <%s>, finish to <%s> the item <%s> document: %s',
      'NOOP': ' -> in <%s>, operation <%s> on the item <%s> document: %s is not defined'
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