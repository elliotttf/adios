'use strict';
const cluster = require('cluster');
const net = require('net');

let server;
let workerSockets = {};

const DEFAULT_PATH = require('../package.json').config.defaultPath;

/**
 * Helper method to execute a callback on each worker.
 *
 * @param {function} cb
 *   A method to execute on each worker. Returns a promise.
 *
 * @return {array}
 *   An array of promises that resolve from cb.
 */
function eachWorker(cb) {
  return Object.keys(cluster.workers)
    .map(id => cb(cluster.workers[id]));
}

/**
 * A SIGINT listener. Notifies all workers that the master process has received
 * SIGINT and allows them tiem to shut down. If a work has not shut down after
 * 10 seconds it will be forcekilled. After all workers have disconnected or
 * been killed the process will exit.
 *
 * @param {int} killTimeout
 *   Time in milliseconds to wait before forcefully killing a child process.
 */
function sigint(killTimeout) {
  let shutdowns = eachWorker(worker => new Promise(resolve => {
    let timeout = setTimeout(() => {
      if (workerSockets[worker.process.pid]) {
        workerSockets[worker.process.pid].end();
      }
      worker.kill();
      resolve();
    }, killTimeout);
    worker.on('disconnect', () => {
      if (workerSockets[worker.process.pid]) {
        workerSockets[worker.process.pid].end();
      }
      clearTimeout(timeout);
      resolve();
    });
    if (workerSockets[worker.process.pid]) {
      workerSockets[worker.process.pid].write('SIGINT');
    }
    worker.disconnect();
  }));

  Promise.all(shutdowns)
    .then(() => server.close(() => {
      server = null;
      process.exit(0);
    }))
    .catch(err => server.close(() => {
      server = null;
      throw err;
    }));
}

/**
 * A SIGTERM listener. Force kills all workers and exits the master process.
 */
function sigterm() {
  eachWorker(worker => worker.kill());
  server.close(() => {
    server = null;
    process.exit(0);
  });
}

module.exports = {
  /**
   * The initialize function for adios masters. Sets up a server for IPC with
   * clustered workers. Note: there can be only one.
   *
   * @param {string} path
   *   (optional) The socket path to use. Defaults to /var/run/adios.sock
   * @param {object} config
   *   (optional) A configuration object for the master process. Contains:
   *   - timeout: time in milliseconds before a child will be force closed.
   *     Default: 10000, 10 seconds.
   *
   * @return {Promise}
   *   Resolves when the server is listening.
   */
  init(path, config) {
    if (!cluster.isMaster) {
      throw new Error('Adios master must be initialized from a master process');
    }
    else if (server) {
      throw new Error('Adios can only be initialized once per process');
    }

    const timeout = (config && config.timeout) || 10000;

    return new Promise(resolve => {
      server = net.createServer(c => {
        let pid;
        c.on('data', msg => {
          msg = msg.toString();
          if (msg.indexOf('pid:') !== -1) {
            pid = msg.split(':')[1];
            workerSockets[pid] = c;
          }
        });

        c.on('end', () => {
          if (pid) {
            delete workerSockets[pid];
          }
        });
      });
      server.listen(path || DEFAULT_PATH, resolve);

      process.on('SIGINT', () => sigint(timeout));
      process.on('SIGTERM', sigterm);
    });
  },

  /**
   * Helper method to destroy the server and remove all listereners. This is
   * most useful for testing and not likely needed for normal operation.
   *
   * @return {Promise}
   *   Resolves when the server has been destroyed.
   */
  destroy() {
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    workerSockets = {};

    if (server) {
      return new Promise(resolve => {
        server.close(() => {
          server = null;
          resolve();
        });
      });
    }

    return Promise.resolve();
  }
};

