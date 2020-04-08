'use strict';

const fs = require('fs');
const util = require('util');
const type = Function.prototype.call.bind( Object.prototype.toString );

// TASKS
//  ? Create paths and files for logging into them
//    ^ add autocreation with right permissions
//  ? Add warning and error counters
//  - Add time in logs
//  - Add configuration on init

class Logger {
  constructor(logFolder='./logs') {
    this.logLevel = 3;

    this.counter = {
      'error'     :  0,
      'warn'     :  0,
    };

    this.mapping = {
      'error' : {
        'raw'     :  '[ERROR]',
        'console' :  '\x1b[1m[\x1b[31mERROR\x1b[0m\x1b[1m]\x1b[0m',
        'files'   :  ['error', 'all'],
        'level'   :  0,
      },
      'debug' : {
        'raw'     :  '[DEBUG]',
        'console' :  '[DEBUG]',
        'files'   :  ['debug'],
        'level'   :  2,
      },
      'warn'  : {
        'raw'     :  '[warn]',
        'console' :  '[\x1b[33m\x1b[5mwarn\x1b[0m]',
        'files'   :  ['error', 'all'],
        'level'   :  1,
      },
      'info'  : {
        'raw'     :  '(info)',
        'console' :  '(\x1b[34minfo\x1b[0m)',
        'files'   :  ['all'],
        'level'   :  0,
      },
    };


    try {
      this.fileObjects = {
        'error' : fs.openSync(`${logFolder}/error.log`, 'a'),
        'debug' : fs.openSync(`${logFolder}/debug.log`, 'a'),
        'all'   : fs.openSync(`${logFolder}/all.log`, 'a'),
      };
    } catch(err) {
      this.warn(`Can't open or create log files.`, '(logger)');
      // catchError.fs(err) or smth
      // System errors here. Like in require, etc
      // EACCESS = permission denied
    };
  };

  async appendLog(type, message, group) {
    let date = new Date();
    let hour = date.getHours();
    let minute = date.getMinutes();
    let second = date.getSeconds();
    let ms = Math.round( process.hrtime()[0] / 100 );

    var currentTime = `${hour}:${minute}:${second} ${ms}`;
    var string = `${group} ${message}`;

    var files = this.mapping[type]['files'];
    var prefix = this.mapping[type]['console'];
    var prefixRaw = this.mapping[type]['raw'];

    if (this.logLevel > this.mapping[type]['level']) {

      console.log( `[${currentTime}] ${prefix}${string}` );

    };

    files.forEach( (item, index) => {
      let file = this.fileObjects[ item ];
      fs.appendFileSync(file, `\n[${currentTime}] ${prefixRaw}${string}`);
    });

    if (this.counter[type]) {
      this.counter[type]++
    }; 
  };

  setLogLevel(level) {
    if (level <= 3 && level > 0) {
      this.logLevel = level;
    };
  };

  // rework in one function like log('error', 'string', 'prefix')
  async error(message, group='') {
    await this.appendLog('error', message, group);
  };

  async warn(message, group='') {
    await this.appendLog('warn', message, group);
  };

  async debug(message, group='') {
    await this.appendLog('debug', message, group);
  };

  async info(message, group='') {
    await this.appendLog('info', message, group);
   };

  async object(obj) {
    console.log(util.inspect(obj, false, null, true));
  };
};

module.exports = Logger;