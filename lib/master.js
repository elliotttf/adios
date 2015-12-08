var cluster = require('cluster');
var initialized = false;

function eachWorker(cb) {
  return Object.keys(cluster.workers).map(function (id) {
    return cb(cluster.workers[id]);
  });
}

module.exports = {
  init: function () {
    if (!cluster.isMaster) {
      throw new Error('Adios master must be initialized from a master process');
    }
    else if (initialized) {
      throw new Error('Adios can only be initialized once per process');
    }

    initialized = true;

    process.on('SIGINT', function () {
      var shutdowns = eachWorker(function (worker) {
        return new Promise(function (resolve) {
          worker.send('SIGINT');
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
          process.exit(0); // eslint-disable-line no-process-exit
        })
        .catch(function (err) {
          console.error(err);
          process.exit(1);
        });
    });
    process.on('SIGTERM', function () {
      eachWorker(function (worker) {
        worker.kill();
      });
      process.exit(0);
    });
  }
};

