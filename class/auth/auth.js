'use strict';

const sqlite = require('sqlite3').verbose();
const sha = require('./sha.js');
const Logger = require(`${global.appRoot}/class/logger/logger.js`)
const log = new Logger();

class Auth {
  static generateRandomString(length) {
    var result = '';
    var characters = 'abcdefghijklmnopqrstuvwxyz' +
                     'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
                     '0123456789' +
                     '~!@$%^&*()_-=+|[]{}?><:';

    while (length) {
      let num = Math.floor( Math.random() * characters.length );
      result += characters.charAt(num);
      length--;
    };

    return result;
  };


  static generateToken(userAgent, random, userId) {
    return sha(userAgent + userId + random);
  };


  // check user session
  static async check(request, token) {
    let userAgent = request.headers['user-agent'];
    let ip = request.headers['x-forwarded-for'] ||
    	       request.connection.remoteAddress;
    let session;

  	let storage = this.openStorage();

    await new Promise((resolve) => {
      return storage.get(
       `SELECT rand, userid, ip FROM sessions
        WHERE token="${token}"`, (err, row) => {
          session = row;
          resolve( row );
        });
    });

    storage.close();

    log.debug(`User-Agent:\n${userAgent}\nIP:\n${ip}`);

    let rand = session?.rand;
    let userId = session?.userid;
    let isAuthorized = token == this.generateToken(userAgent, rand, userId);
    let isTrusted = ip == session?.ip;

    return isAuthorized? ( isTrusted? 'TRUSTED':'UNTRUSTED' ):false;
  };


  // add user to sessions database
  static async authorize(request, username, password) {
    let userAgent = request.headers['user-agent'];
    let ip = request.headers['x-forwarded-for'] ||
             request.connection.remoteAddress;
    let passwordHash = sha(password);
  	let storage = this.openStorage();

    let account;

    await new Promise((resolve) => {
      return storage.get(
       `SELECT username, password, id FROM users
        WHERE username="${username}"
        AND password="${passwordHash}"`, (err, row) => {
          account = row;
          resolve( row );
        });
    });

    log.debug(`Login into ${username} ${ account? 'succesful':'failed' }`);

    if ( account ) {
    	let random = this.generateRandomString(8);
      var token = this.generateToken(userAgent, random, account.id);

      storage.serialize( () => {
        storage.run(`INSERT OR FAIL INTO sessions (userid, token, ip, rand)
        	           VALUES (${account.id}, "${token}", "${ip}", "${random}")`);
      });    
    }

    storage.close();
    return token;
  };


  static async register(username, password) {
    let storage = this.openStorage();
    let isUserExists;

    await new Promise((resolve) => {
      return storage.get(
       `SELECT id, username FROM users
        WHERE username="${username}"`, (err, row) => {
          isUserExists = row;
          resolve( row );
        });
    });

    if ( !isUserExists ) {
      let passwordHash = sha(password);
	    storage.run(`INSERT OR FAIL INTO users (username, password)
	    	           VALUES ("${username}","${passwordHash}")`);
    } else {
      throw( new Error('User alredy exists') );
    };

    storage.close();
  };


  // wiil be available in future
  static getActiveSessions(request) {
  };


  static openStorage() {
  	return new sqlite.Database('./class/auth/storage');
  };


  static prepare() {
    let storage = new sqlite.Database('./class/auth/storage');

  	storage.serialize( () => {
  	  storage.run(`CREATE TABLE IF NOT EXISTS users (
  	  	            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  	                username VARCHAR(32) NOT NULL,
  	                password VARCHAR(128) NOT NULL,
  	                UNIQUE(username))`
  	             );

      storage.run(`CREATE TABLE IF NOT EXISTS sessions (
  	  	            userid INT NOT NULL,
  	                token VARCHAR(128) NOT NULL,
  	                ip VARCHAR(15) NOT NULL,
  	                rand VARCHAR(32) NOT NULL)`
  	             );
    });

    storage.close();
  };
};

module.exports = Auth;