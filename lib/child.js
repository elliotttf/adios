var cluster = require('cluster');
var initialized = false;

module.exports = {
  init: function (cleanCb) {
    if (cluster.isMaster) {
      throw new Error('Adios child must be initialized from a child process');
    }
    else if (typeof cleanCb !== 'function') {
      throw new Error('Adios child must be initialized with an exit callback.');
    }
    else if (initialized) {
      throw new Error('Adios can only be initialized once per process');
    }

    initialized = true;

    process.on('message', function (msg) {
      if (msg === 'SIGINT') {
        cleanCb()
          .then(function () {
            process.exit(0);
          })
          .catch(function (err) {
            console.error(err);
            process.exit(1);
          });
      }
    });
  }
};

