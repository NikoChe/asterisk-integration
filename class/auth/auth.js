'use strict';

const sqlite = require('sqlite3');
const sha = require('./sha.js');
const Logger = require(`${global.appRoot}/class/logger/logger.js`)
const log = new Logger();

class Auth {
  constructor() {

  };

  check(request) {
    console.log(request)
  };

  authorize(request) {

  };

  getActiveSessions(request) {

  };
};

module.exports = Auth;