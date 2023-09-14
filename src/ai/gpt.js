const shell = require('shelljs');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

function GPT4ALL(app) {
  EventEmitter.call(this);
  this.status = 0;
  this.buffer = '';
  this.command = app; // Store the command for reference

  var self = this;

  const result = shell.exec(app, { silent: false, async: false });

  if (result.code === 0) {
    // Command completed successfully
    self.status = 1;
    self.emit('ready');
    self.buffer = result.stdout;
  } else {
    // Handle errors, e.g., by emitting an 'error' event
    self.emit('error', result.stderr);
  }
}

util.inherits(GPT4ALL, EventEmitter);

GPT4ALL.prototype.ask = function (msg) {
  if (!this.status) return null;
  var self = this;
  return new Promise(function (resolve) {
    const result = shell.exec(self.command + ' ' + msg, { silent: false, async: false });

    if (result.code === 0) {
      self.buffer = result.stdout;
      self.emit('data', self.buffer);
      resolve(self.buffer);
    } else {
      // Handle errors, e.g., by emitting an 'error' event
      self.emit('error', result.stderr);
      resolve(null);
    }
  });
};

module.exports = GPT4ALL;
