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

      asterisk: {
        odbc: {
          dsn: 'node',
          username: 'node',
          password: '123',
        },
      }
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
      'auth'           : this.authorize,
      'register'       : this.register,
    };
  };


  static error(errorCode) {
    return {
      code    : errorCode,
      headers : { 'Content-Type': 'text/plain' },
      body    : '',
    };
  };


  static parse(url) {
    return url.split( /\// ).filter(Boolean);
  };


  async register(request, body, auth) {
    let destination = Server.parse(request.url);

    if ( auth == 'UNTRUSTED' ) {
      return Server.error(401);

    } else if ( request.method == 'POST' &&
         destination.length == 1 ) {
      try {
        await Auth.register(body.username, body.password);
        return {
          code    : 200,
          headers : {'Content-Type': 'text/plain'},
          body    : '',
        };

      } catch(err) {
        log.debug(err);
        return Server.error(500);
      };

    } else {
      return Server.error(400)
    };
  };


  async authorize(request, body, auth) {
    let destination = Server.parse(request.url);

    if ( request.method == 'POST' &&
         destination.length == 1 ) {
      try {
        let token = await Auth.authorize(request, body.username, body.password);
        
        if (token) {
          return {
            code    : 200,
            headers : {'Content-Type': 'text/plain'},
            body    : JSON.stringify({
              token : token,
            }),
          };

        } else {
          return Server.error(401);
        };

      } catch(err) {
        log.debug(err);
        return Server.error(500);
      };

    } else {
      return Server.error(400)
    };
  };


  // Needs refactoring
  async getRecordingFile(request, body, auth) {
    let validId = /^\d{10}\.\d{1,6}$/;
    let destination = Server.parse(request.url);

    if ( destination.length == 2 &&
         request.method == 'GET' &&
         validId.test( destination[1] ) ) {

      let callId = destination[1];

      if ( fs.existsSync(`./rec/${callId}.mp3`) ) {
        return {
            code     : 200,
            headers  : {'Content-Type': 'application/json'},
            body     : JSON.stringify({
              path: `recordings/${callId}.mp3`
            }),
          };

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

        await exec(`sox ${pathToGsm} ./rec/${callId}.mp3`);
        return {
          code     : 200,
          headers  : {'Content-Type': 'application/json'},
          body     : JSON.stringify({
            path: `recordings/${callId}.mp3`,
          }),
        };
      };

    } else {
      return Server.error(400);
    };
  };


  async callStatistics(request, body, auth) {
    let validDate = /^\d{4}-[0|1]\d-\d{2}_[0-2]\d:[0-6]\d:[0-6]\d$/;
    let destination = this.parse(request.url);

    if ( destination.length == 3 &&
         request.method == 'GET' &&
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

      return {
        code     : 200,
        headers  : {'Content-Type': 'application/json'},
        body     : JSON.stringify(result),
      };

    } else {
      return Server.error(400);
    };
  };


  async aliveStatus(request, body, auth) {
    if ( Server.parse(request.url).length == 1 ||
         method == 'GET' ) {
      return {
        code     : 200,
        headers  : {'Content-Type': 'application/json'},
        body     : JSON.stringify({
          foo  : 'bar',
          ping : 'pong',
          iam  : 'Alive',
        }),
      };

    } else {
      return Server.error(400);
    };
  };


  async handleRequest(request, response) {
    log.debug('Received request:', '(Server)');
    log.debug(request.url);
    log.debug(request.method);

    let chunks = [];
    let req = request;
    let res = response;

    req.on('data', chunk => chunks.push(chunk))
       .on('end', async () => {

      let body = JSON.parse( Buffer.concat(chunks) );
      let authStatus = await Auth.check(req, body.token);

      if ( authStatus || /^\/auth\/?$/g.test(req.url) ) {
        try {
          var response = await this.routing[
            Server.parse(req.url)[0]
          ](req, body, authStatus);

        } catch(err) {
          var response = Server.error(404);
          log.debug(err)
        };

      } else {
        var response = Server.error(401);
      };

      log.object(response);
      log.debug(`Response: ${response.code}`, '(Server)');

      res.writeHead(response.code, response.headers);
      res.write(response.body);
      res.end();
    });
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
    await db.validate();

  // create storage file for tokens and accounts
  Auth.prepare();

  //  await db.execQuery(`DESCRIBE cdr`);
  let server = new Server(params.server);
  server.start()

  };
})();