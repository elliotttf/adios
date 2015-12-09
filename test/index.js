var child = require('child_process');
var cluster = require('cluster');
var Adios = require('../');

module.exports = {
  setUp: function (cb) {
    this.stubs = [];
    this.origMaster = cluster.isMaster;
    cb();
  },
  tearDown: function (cb) {
    this.stubs.forEach(function (stub) {
      stub.restore();
    });
    cluster.isMaster = this.origMaster;
    Adios.child.destroy();
    Adios.master.destroy();
    cb();
  },
  master: require('./master'),
  child: require('./child')
};

