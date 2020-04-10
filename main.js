// Asterisk X247 integration alpha 0.5
// Master server
// NodeJS v13.7.0

'use strict';

// TODO
//  -startup timer with process.hrtime

var params, db;
const ws = require('ws');
const fs = require('fs');
const http = require('http');
const util = require('util');
const path = require('path');
const exec = util.promisify( require('child_process').exec );

global.appRoot = path.resolve(__dirname);

const Database = require('./class/odbc/odbc.js');
const Auth = require('./class/auth/auth.js');
const Logger = require('./class/logger/logger.js');
const log = new Logger();


class Config {
  static read() {
  	var values;
    var path = './config/config.json';
    var defaultValues = {
    	server: {
        host: '0.0.0.0',
        port: '8080',
        knownIPs: ['127.0.0.1'],
    	},

      asterisk: {
        recordsFolder:'/var/spool/asterisk/monitor',
      },

      odbc: {
        dsn: 'node',
        username: 'node',
        password: '123',

        aliases: {
          cdr: 'cdr',
          cel: 'cel',
        },
      },

    };

    try {
      values = require(path);
      if (typeof values != 'object' || !values) {
        log.error(`Config file is broken, fix or remove it`);
      };

    } catch (err) {
      if (err.code == 'MODULE_NOT_FOUND') {
        values = defaultValues;
        Config.generate(path, defaultValues);
      // } else if (err.code == 'EACCES'){
      //   console.error('Can't read config file: Permission Denied')
      } else {
        log.error(`An error occurred while opening config file: ${err.code}`);
      };
    };

    return values;
  };

  static generate(path, values) {
    log.info(`Doesn't find the config file, generating a new one`);
    fs.writeFile(path, JSON.stringify(values, null, 2), err => {
      if (err) {
        log.error(`An error occurred while writing config file: ${err.code}`)
      };
    });
  };

  // FIXME!
  static check(config) {
  	let validConfig = {
      server: {
        host: /^([0-255]\.[0-255]\.[0-255]\.[0-255])$/,
        port: /^\d{1,5}$/,
        knownIPs: /^([0-255]\.[0-255]\.[0-255]\.[0-255])$/,
    	},

      odbc: {
        dsn: '',
        username: '',
        password: '',
      },
  	};

    //return validPort.test();
  };
};



class Server {
  constructor(configFile) {
    this.config = configFile;
    this.routing = {
      'callStatistics' : this.callStatistics,
      'aliveStatus'    : this.aliveStatus,
      'recordingFile'  : this.getRecordingFile,
    };
  };

  static error(errorCode) {
    return [ errorCode ];
  };

  parse( url ) {
    return url.split( /\// ).filter(Boolean);
  };

  // Needs refactoring
  async getRecordingFile(method, destination) {
    let validId = /^\d{10}\.\d{1,6}$/;

    if ( destination.length == 2 &&
         method == 'GET' &&
         validId.test( destination[1] ) ) {

      let callId = destination[1];
      let ls = `ls ./rec | grep ${callId}`;
      var filename = null;

      // doesnt work now,
      // TODO find file with fs
      // exec( ls, ( err, stdout ) => {
      //   filename = stdout;
      // });

      if ( filename ) {
        return [200, { path: `recordings/${filename}` }];

      } else {
        let query = `SELECT recordingfile FROM cdr \
                     WHERE uniqueid="${callId}" LIMIT 1;`;

        let queryResult = await db.execQuery(query);
        let recordingfile = queryResult[0]['recordingfile'];

        log.object( queryResult );

        if ( !recordingfile ) {
          log.debug(`There's no recording in DB.`);
          return Server.error(404);
        };

        let recordsFolder = params.asterisk.recordsFolder;
        let pathToGsm = `${recordsFolder}/${recordingfile}.gsm`;
        var pathToMp3 = `recordings/${callId}.mp3`;

        await exec( `sox ${pathToGsm} ./rec/${callId}.mp3` );

        if ( pathToMp3 ) {
          return [200, { path: pathToMp3 }];
        } else {
          return Server.error(500);
        };

      };
    } else {
      return Server.error(400);
    }
  };


  async callStatistics(method, destination) {
    let validDate = /^\d{4}-[0|1]\d-\d{2}_[0-2]\d:[0-6]\d:[0-6]\d$/;

    if ( destination.length == 3 &&
         method == 'GET' &&
         validDate.test( destination[1] ) &&
         validDate.test( destination[2] ) ) {

      let from = destination[1].replace(/_/g, ' ');
      let to = destination[2].replace(/_/g, ' ');

      let query = `SELECT * FROM \
                  (SELECT calldate, src, dst, dcontext, \
                  billsec, disposition, uniqueid FROM cdr WHERE\
                  calldate>="${from}" AND calldate<="${to}" AND dst!="#20"\
                  AND dst!="#10" ORDER BY billsec DESC ) x \
                  GROUP BY uniqueid ORDER BY calldate;`;

      let result = await db.execQuery(query);
      log.object(result['columns']);

      return [200, result];

    } else {
      return Server.error(400);
    };
  };


  async aliveStatus(method, destination) {
    let data = {
      foo: 'bar',
      ping: 'pong',
      iam: 'Alive',
    };

    if ( destination.length == 1 || method == 'GET' ) {
      return [200, data];
    } else {
      return Server.error(400);
    };
  };


  async handleRequest(req, res) {
    log.debug('Received request:', '(Server)');
    log.debug(req.url);
    log.debug(req.method);
    log.object(req);

    let method = req.method;
    let url = req.url;
    let dest = this.parse(url);

    try {
      var response = await this.routing[ dest[0] ]( method, dest );
      var data = response[1]? JSON.stringify( response[1] ):'';
      var code = response[0];

    } catch(err) {
      log.debug(err);
      var data = '';
      var code = 404;

    }

    // TODO Must be text/plain on errors
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.write(data);
    res.end()

    log.debug(`Response: ${code}`, '(Server)');
  };


  start() {
    log.info('Starting server at the '+ this.config.host +':'+ this.config.port);
    http.createServer((req,res) => {
      this.handleRequest(req, res);
    }).listen(this.config.port, this.config.host);
  };


};

(async () => {
  params = Config.read();

  if (params){
    db = new Database(params.odbc);
    if (await db.connect()) {
      await db.validate();

    };

    // await db.getTable('cdr');

  //  await db.execQuery(`DESCRIBE cdr`);
  let server = new Server(params.server);
  server.start()

  };
})();