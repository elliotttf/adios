var cluster = require('cluster');
var net = require('net');
var process = require('process');
var sinon = require('sinon');
var Adios = require('../');

var DEFAULT_PORT = require('../package.json').config.defaultPort;

module.exports = {
  tearDown: function (cb) {
    if (this.server) {
      this.server.close(cb);
    }
    else {
      cb();
    }
  },
  fail: {
    setUp: function (cb) {
      Adios.master.init().then(cb);
      cluster.isMaster = false;
    },
    withoutMaster: function (test) {
      test.expect(1);
      Adios.master.destroy();

      Adios.child.init(console.log)
        .then(test.done)
        .catch(function (err) {
          test.equal('ECONNREFUSED', err.code);
          test.done();
        });
    },
    fromMaster: function (test) {
      test.expect(1);
      cluster.isMaster = true;

      test.throws(function () {
        Adios.child.init();
      }, 'Child initialized from master.');

      test.done();
    },
    withoutCb: function (test) {
      test.expect(1);

      test.throws(function () {
        Adios.child.init();
      }, 'Child initialized without callback.');

      test.done();
    },
    twice: function (test) {
      test.expect(2);

      test.doesNotThrow(function () {
        Adios.child.init(console.log)
      }, 'Child not initialized.');

      test.throws(function () {
        Adios.child.init(console.log);
      }, 'Child initialized twice.');

      test.done();
    }
  },
  comm: {
    announcePid: function (test) {
      test.expect(1);

      this.server = net.createServer(function (c) {
        c.on('data', function (msg) {
          Adios.child.destroy();
          test.equal(msg.toString().indexOf('pid:'), 0, 'Pid not announced.');
          test.done();
        });
      });
      this.server.listen(DEFAULT_PORT, function () {
        cluster.isMaster = false;
        Adios.child.init(console.log);
      });
    },
    sigint: function (test) {
      test.expect(2);

      this.stubs.push(sinon.stub(process, 'exit', function (code) {
        test.equal(0, code, 'Process did not exit cleanly.');
        test.done();
      }));

      this.server = net.createServer(function (c) {
        c.write('SIGINT');
      });
      this.server.listen(DEFAULT_PORT, function () {
        cluster.isMaster = false;
        Adios.child.init(function () {
          test.ok(true, 'Executed clean callback.');
          return Promise.resolve();
        });
      });
    }
  }
};

