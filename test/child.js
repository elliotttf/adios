'use strict';
const cluster = require('cluster');
const net = require('net');
const sinon = require('sinon');
const Adios = require('../');

const DEFAULT_PATH = require('../package.json').config.defaultPath;

module.exports = {
  tearDown(cb) {
    if (this.server) {
      this.server.close(cb);
    }
    else {
      cb();
    }
  },
  fail: {
    setUp(cb) {
      Adios.master.init().then(cb);
      cluster.isMaster = false;
    },
    withoutMaster(test) {
      test.expect(1);
      Adios.master.destroy();

      Adios.child.init(console.log)
        .then(test.done)
        .catch(() => {
          test.ok(true, 'Error connecting caught.');
          test.done();
        });
    },
    fromMaster(test) {
      test.expect(1);
      cluster.isMaster = true;

      test.throws(() => {
        Adios.child.init();
      }, 'Child initialized from master.');

      test.done();
    },
    withoutCb(test) {
      test.expect(1);

      test.throws(() => {
        Adios.child.init();
      }, 'Child initialized without callback.');

      test.done();
    },
    twice(test) {
      test.expect(2);

      test.doesNotThrow(() => {
        Adios.child.init(console.log);
      }, 'Child not initialized.');

      test.throws(() => {
        Adios.child.init(console.log);
      }, 'Child initialized twice.');

      test.done();
    }
  },
  comm: {
    announcePid(test) {
      test.expect(1);

      this.server = net.createServer(c => {
        c.on('data', msg => {
          Adios.child.destroy();
          test.equal(msg.toString().indexOf('pid:'), 0, 'Pid not announced.');
          test.done();
        });
      });
      this.server.listen(DEFAULT_PATH, () => {
        cluster.isMaster = false;
        Adios.child.init(console.log);
      });
    },
    sigint(test) {
      test.expect(2);

      this.stubs.push(sinon.stub(process, 'exit', code => {
        test.equal(0, code, 'Process did not exit cleanly.');
        test.done();
      }));

      this.server = net.createServer(c => c.write('SIGINT'));
      this.server.listen(DEFAULT_PATH, () => {
        cluster.isMaster = false;
        Adios.child.init(() => {
          test.ok(true, 'Executed clean callback.');
          return Promise.resolve();
        });
      });
    }
  }
};

