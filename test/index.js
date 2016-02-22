'use strict';
const cluster = require('cluster');
const os = require('os');
const path = require('path');
const sinon = require('sinon');
const Adios = require('../');

module.exports = {
  setUp(cb) {
    this.stubs = [];
    this.testSock = path.join(os.tmpDir(), `${Date.now()}-adios.sock`);

    this.clock = sinon.useFakeTimers();
    this.origMaster = cluster.isMaster;
    cb();
  },
  tearDown(cb) {
    this.stubs.forEach(stub => stub.restore());
    this.clock.restore();
    cluster.isMaster = this.origMaster;
    Adios.child.destroy();
    Adios.master.destroy()
      .then(() => {
        cb();
      });
  },
  master: require('./master'),
  child: require('./child')
};

