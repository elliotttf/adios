'use strict';
const cluster = require('cluster');
const net = require('net');

let socket;

const DEFAULT_PATH = require('../package.json').config.defaultPath;

module.exports = {
  init(cleanCb, path) {
    if (cluster.isMaster) {
      throw new Error('Adios child must be initialized from a child process');
    }
    else if (typeof cleanCb !== 'function') {
      throw new Error('Adios child must be initialized with an exit callback.');
    }
    else if (socket) {
      throw new Error('Adios can only be initialized once per process');
    }

    return new Promise((resolve, reject) => {
      socket = net.connect(path || DEFAULT_PATH, () => {
        socket.write('pid:' + process.pid);
        resolve();
      })
        .setKeepAlive(true)
        .on('data', (msg) => {
          msg = msg.toString();
          if (msg === 'SIGINT') {
            cleanCb()
              .then(() => {
                socket.end();
                process.exit(0);
              });
          }
        })
        .on('error', reject);
    });
  },
  destroy() {
    if (socket) {
      socket.destroy();
      socket = null;
    }
  }
};

