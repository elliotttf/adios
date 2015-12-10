'use strict';
const cluster = require('cluster');
const net = require('net');

let server;
let workerSockets = {};

const DEFAULT_PATH = require('../package.json').config.defaultPath;

function eachWorker(cb) {
  return Object.keys(cluster.workers)
    .map(id => cb(cluster.workers[id]));
}

function sigint() {
  let shutdowns = eachWorker(worker => new Promise(resolve => {
    let timeout = setTimeout(() => {
      if (workerSockets[worker.process.pid]) {
        workerSockets[worker.process.pid].end();
      }
      worker.kill();
      resolve();
    }, 10000);
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

function sigterm() {
  eachWorker(worker => worker.kill());
  server.close(() => {
    server = null;
    process.exit(0);
  });
}

module.exports = {
  init(path) {
    if (!cluster.isMaster) {
      throw new Error('Adios master must be initialized from a master process');
    }
    else if (server) {
      throw new Error('Adios can only be initialized once per process');
    }

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

      process.on('SIGINT', sigint);
      process.on('SIGTERM', sigterm);
    });
  },
  destroy() {
    process.removeListener('SIGINT', sigint);
    process.removeListener('SIGTERM', sigterm);
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

