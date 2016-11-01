'use strict';

const cluster = require('cluster');
const net = require('net');

let socket;

const DEFAULT_PATH = require('../package.json').config.defaultPath;

module.exports = {
  /**
   * The initialize function for adios children. Sets up a connection to the
   * master. Note: there can be only one per process and it mist be running
   * on a child process.
   *
   * @param {function} cleanCb
   *   The method to execute when the master is notifying of a shutdown.
   *   Must return a promise that resolves when work is done.
   * @param {string} path
   *   (optional) The socket path to use. Defaults to /var/run/adios.sock
   *
   * @return {Promise}
   *   Resolves when the connection with the master has been established.
   */
  init(cleanCb, path = DEFAULT_PATH) {
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
      socket = net.connect(path, () => {
        socket.write(`pid:${process.pid}`);
        resolve();
      })
        .setKeepAlive(true)
        .on('data', (msg) => {
          const msgStr = msg.toString();
          if (msgStr === 'SIGINT') {
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
  },
};

