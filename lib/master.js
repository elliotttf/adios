'use strict';

const cluster = require('cluster');
const net = require('net');

let server;
let workerSockets = {};

const DEFAULT_PATH = require('../package.json').config.defaultPath;

/**
 * Kill workers.
 *
 * @param {cluster.Worker} worker
 *   The worker to kill.
 *
 * @return {undefined}
 */
function killWorker(worker) {
  if (workerSockets[worker.process.pid]) {
    workerSockets[worker.process.pid].end();
  }
  worker.kill();
}

/**
 *  Terminate workers gracefully and fall back to killing.
 *
 * @param {int} killTimeout
 *   The time in milliseconds before killing a child process.
 * @param {cluster.Worker} worker
 *   The worker to terminate.
 *
 * @return {Promise}
 *   Resolves when the child process has been terminated or killed.
 */
function termWorker(killTimeout, worker) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      killWorker(worker);
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
  });
}

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
 *
 * @return {undefined}
 */
function sigint(killTimeout) {
  const shutdowns = eachWorker(termWorker.bind(null, killTimeout));

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
 *
 * @return {undefined}
 */
function sigterm() {
  eachWorker(killWorker);
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
  init(path = DEFAULT_PATH, config) {
    if (!cluster.isMaster) {
      throw new Error('Adios master must be initialized from a master process');
    }
    else if (server) {
      throw new Error('Adios can only be initialized once per process');
    }

    this.timeout = (config && config.timeout) || 10000;

    return new Promise((resolve) => {
      server = net.createServer((c) => {
        let pid;
        c.on('data', (msg) => {
          const msgStr = msg.toString();
          if (msgStr.startsWith('pid:')) {
            pid = msgStr.split(':')[1];
            workerSockets[pid] = c;
          }
        });

        c.on('end', () => {
          if (pid) {
            delete workerSockets[pid];
          }
        });
      });
      server.listen(path, resolve);

      process.on('SIGINT', () => sigint(this.timeout));
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
      return new Promise((resolve) => {
        server.close(() => {
          server = null;
          resolve();
        });
      });
    }

    return Promise.resolve();
  },

  /**
   * Method to kill a worker by process id.
   *
   * @param {int} pid
   *   The process id to kill.
   *
   * @return {undefined}
   */
  kill(pid) {
    const worker = cluster.workers[
      Object.keys(cluster.workers)
        .find(k => cluster.workers[k].process.pid === parseInt(pid, 10))
    ];
    if (!worker) {
      throw new Error(`No worker found with pid: ${pid}`);
    }

    killWorker(worker);
  },

  /**
   * Method to terminate a worker by process id, this will call the graceful
   * shutdown defined by the worker.
   *
   * @param {int} pid
   *   The process id to terminate.
   *
   * @return {Promise<undefined>}
   *   Resolved when the worker is terminated.
   */
  term(pid) {
    const worker = cluster.workers[
      Object.keys(cluster.workers)
        .find(k => cluster.workers[k].process.pid === parseInt(pid, 10))
    ];
    if (!worker) {
      throw new Error(`No worker found with pid: ${pid}`);
    }
    return termWorker(this.timeout, worker);
  },
};

