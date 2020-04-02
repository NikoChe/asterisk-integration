'use strict';

// Random password generator

class Passwords {
  constructor() {
    this.length = null
    this.notAllowed = null

    this.symbols = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      '~!@$%^&*()_-=+|[]{}?><:'
    ]
  }

  // Returns randnom num
  // from 0 to range
  getRandomNum(range) {
    let random = Math.random()
    let num = random * range

    return Math.floor(num)
  }

  // Returns random string
  generateRandomPass() {
    let password = ''

    for (let i = this.length; i; i--) {
      let symbol = null

      while (!symbol) {
        let symbolGroup = this.getRandomNum(this.symbols.length)
        let symbolNum = this.getRandomNum(this.symbols[symbolGroup].length)
        symbol = this.symbols[symbolGroup].charAt(symbolNum)

        if ( this.notAllowed.includes(symbol) ) {
          symbol = null
        } else {
          password += symbol 
        };
      }
    }

    return password
  }

  static generate(length=8, quantity=1, notAllowed='') {
    let core = new Passwords()
    let result = []

    core.length = length
    core.notAllowed = notAllowed

    for (let i = quantity; i; i--) {
      let password = core.generateRandomPass()
      result.push(password)
    }

    return result
  }
}

module.exports = Passwords;