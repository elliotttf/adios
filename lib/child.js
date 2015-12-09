var cluster = require('cluster');
var net = require('net');

var socket;

var DEFAULT_PORT = require('../package.json').config.defaultPort;

module.exports = {
  init: function (cleanCb, port) {
    if (cluster.isMaster) {
      throw new Error('Adios child must be initialized from a child process');
    }
    else if (typeof cleanCb !== 'function') {
      throw new Error('Adios child must be initialized with an exit callback.');
    }
    else if (socket) {
      throw new Error('Adios can only be initialized once per process');
    }

    return new Promise(function (resolve, reject) {
      socket = net.connect(port || DEFAULT_PORT, function () {
        socket.write('pid:' + process.pid);
        resolve();
      })
        .setKeepAlive(true)
        .on('data', function (msg) {
          msg = msg.toString();
          if (msg === 'SIGINT') {
            cleanCb()
              .then(function () {
                socket.end();
                process.exit(0);
              });
          }
        })
        .on('error', function (err) {
          if (!this.localPort) {
            reject(err);
          }
          else {
            throw err;
          }
        })
    });
  },
  destroy: function () {
    if (socket) {
      socket.destroy();
      socket = null;
    }
  }
};

