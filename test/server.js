var cluster = require('cluster');
var Adios = require('../');

if (cluster.isMaster) {
  Adios.master.init();
  cluster.fork();
}
else {
  Adios.child.init(function () {
    console.log('exiting child');
    return Promise.resolve();
  });
}
