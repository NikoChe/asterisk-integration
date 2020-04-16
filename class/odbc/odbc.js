'use strict'

const odbc = require('odbc');
const Logger = require(`${global.appRoot}/class/logger/logger.js`);
const log = new Logger();

class Database {
  constructor(odbcConfig) {
    this.config = odbcConfig;
    this.cdrName = this.config.aliases.cdr;
    this.celName = this.config.aliases.cel;
    this.cdrFields = 0;
  };

  async connect() {
    log.debug(`Connecting to database`);

    let uname = this.config.username;
    let pass = this.config.password;
    let dsn = this.config.dsn;

    log.debug(`dsn = ${dsn}`, '(odbc)');
    log.debug(`username = ${uname}`, '(odbc)');
    log.debug(`pass = ${ pass? 'yes':'no' }`, '(odbc)');

    let connectionParams = {
      connectionString: `DSN=${dsn};Uid=${uname};Pwd=${pass};`,
      connectionTimeout: 15,
      loginTimeout: 15,
    };

    try {
      return await odbc.connect(connectionParams);

    } catch(err) {
    	// FIXME!
      //  -add error codes from:
      // docs.microsoft.com/en-us/sql/odbc/reference/develop-app/sqlstate-mappings
      //  -put this logic in sqlerror function/class

      let state = err.odbcErrors[0].state;
      let causes = {
        'HY000' : 'does db is running?',
      };

      let cause = causes[state]? causes[state]:'undefined';
      log.error(`Can't connect to the database: ${cause}`, '(odbc)');
    };
  };

  async execQuery(string) {
    log.debug(`Executing query: '${string}'`, '(odbc)');

    try {
      let db = await this.connect()
      let result = await db.query(string);
      
      db.close();

      return result;

    } catch(err) {
      // Finding the cause of the error here
      log.error(`Unable to execute query`, '(odbc)');
    };
  };

  // FIXME!
  async validate() {
    let schema = await this.execQuery(`DESCRIBE ${this.cdrName}`);

    let length = schema.count;
    let result = {
      recordingfile: false,
      callerNumber: false, 
    };

    log.info(`Validating database with dsn: ${this.config.dsn}`, '(odbc)');

    while (length) {
      let i = length - 1;

      if ( schema[i].Field == 'recordingfile' ) {
        log.info(`Found recordingfile in cdr`, '(odbc)');
        result.recordingfile = true;

      } else if ( schema[i].Field == 'cnum' ) {
        log.info(`Found callerNumber in cdr`, '(odbc)');
        result.callerNumber = true;

      };

      length--;
    };

    this.cdrFields = result;
    log.debug('Validation result:', '(odbc)');
    log.object(result);
  };

  // async getTable(tableName) {
  //   log.debug(`Geting table schema of ${tableName}`, '(odbc)');

  //   try {
  //     let result = await this.db.tables(null, null, tableName, null);
  //     log.debug(result);
  //     return result;

  //   } catch(err) {
  //     // Finding the cause of the error here
  //     log.error(`Can't get table schema of ${tableName}:`, '(odbc)');
  //     log.error(err);
  //   };
  // };
};

module.exports = Database;