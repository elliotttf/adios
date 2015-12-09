'use strict';
const cluster = require('cluster');
const Adios = require('../');

module.exports = {
  setUp(cb) {
    this.stubs = [];
    this.origMaster = cluster.isMaster;
    cb();
  },
  tearDown(cb) {
    this.stubs.forEach(stub => stub.restore());
    cluster.isMaster = this.origMaster;
    Adios.child.destroy();
    Adios.master.destroy()
      .then(cb);
  },
  master: require('./master'),
  child: require('./child')
};

