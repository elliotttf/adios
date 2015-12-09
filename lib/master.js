var cluster = require('cluster');
var net = require('net');

var server;

var DEFAULT_PORT = require('../package.json').config.defaultPort;

function eachWorker(cb) {
  return Object.keys(cluster.workers).map(function (id) {
    return cb(cluster.workers[id]);
  });
}

module.exports = {
  init: function (port) {
    if (!cluster.isMaster) {
      throw new Error('Adios master must be initialized from a master process');
    }
    else if (server) {
      throw new Error('Adios can only be initialized once per process');
    }

    var workerSockets = {};

    return new Promise(function (resolve) {
      server = net.createServer(function (c) {
        var pid;
        c.on('data', function (msg) {
          msg = msg.toString();
          if (msg.indexOf('pid:') !== -1) {
            pid = msg.split(':')[1]
            workerSockets[pid] = c;
          }
        });

        c.on('end', function () {
          if (pid) {
            delete workerSockets[pid];
          }
        });
      });
      server.listen(port || DEFAULT_PORT, resolve);

      process.on('SIGINT', function () {
        var shutdowns = eachWorker(function (worker) {
          return new Promise(function (resolve) {
            if (workerSockets[worker.process.pid]) {
              workerSockets[worker.process.pid].write('SIGINT');
            }
            worker.disconnect();
            var timeout = setTimeout(function () {
              worker.kill();
              resolve();
            });
            worker.on('disconnect', function () {
              clearTimeout(timeout);
              resolve();
            });
          });
        });

        Promise.all(shutdowns)
          .then(function () {
            server.close(function () {
              process.exit(0); // eslint-disable-line no-process-exit
            });
          })
          .catch(function (err) {
            console.error(err);
            server.close(function () {
              process.exit(1);
            });
          });
      });
      process.on('SIGTERM', function () {
        eachWorker(function (worker) {
          worker.kill();
        });
        process.exit(0);
      });
    });
  },
  destroy: function () {
    if (server) {
      server.close(function () {
        server = null;
      });
    }
  }
};

