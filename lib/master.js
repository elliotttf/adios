'use strict';
const cluster = require('cluster');
const net = require('net');

let server;

const DEFAULT_PATH = require('../package.json').config.defaultPath;

function eachWorker(cb) {
  return Object.keys(cluster.workers)
    .map(id => cb(cluster.workers[id]));
}

module.exports = {
  init(path) {
    if (!cluster.isMaster) {
      throw new Error('Adios master must be initialized from a master process');
    }
    else if (server) {
      throw new Error('Adios can only be initialized once per process');
    }

    let workerSockets = {};

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

      process.on('SIGINT', () => {
        let shutdowns = eachWorker(worker => new Promise(resolve => {
          if (workerSockets[worker.process.pid]) {
            workerSockets[worker.process.pid].write('SIGINT');
          }
          worker.disconnect();
          let timeout = setTimeout(() => {
            worker.kill();
            resolve();
          });
          worker.on('disconnect', () => {
            clearTimeout(timeout);
            resolve();
          });
        }));

        Promise.all(shutdowns)
          .then(() => server.close(() => process.exit(0))) // eslint-disable-line no-process-exit
          .catch(err => server.close(() => {
            throw err;
          }));
      });
      process.on('SIGTERM', () => {
        eachWorker(worker => worker.kill());
        process.exit(0);
      });
    });
  },
  destroy() {
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

