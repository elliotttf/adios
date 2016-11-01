'use strict';

const cluster = require('cluster');
const net = require('net');
const sinon = require('sinon');
const Adios = require('../');

/**
 * Noop
 * @return {undefined}
 */
function noop() {
}

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
      Adios.master.init(this.testSock).then(cb);
      cluster.isMaster = false;
    },
    withoutMaster(test) {
      test.expect(1);
      Adios.master.destroy();

      Adios.child.init(noop)
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
        Adios.child.init(noop, this.testSock);
      }, 'Child not initialized.');

      test.throws(() => {
        Adios.child.init(noop);
      }, 'Child initialized twice.');

      test.done();
    },
  },
  comm: {
    announcePid(test) {
      test.expect(1);

      this.server = net.createServer((c) => {
        c.on('data', (msg) => {
          Adios.child.destroy();
          test.equal(msg.toString().indexOf('pid:'), 0, 'Pid not announced.');
          test.done();
        });
      });
      this.server.listen(this.testSock, () => {
        cluster.isMaster = false;
        Adios.child.init(noop, this.testSock);
      });
    },
    sigint(test) {
      test.expect(2);

      this.stubs.push(sinon.stub(process, 'exit', (code) => {
        test.equal(0, code, 'Process did not exit cleanly.');
        test.done();
      }));

      this.server = net.createServer(c => c.write('SIGINT'));
      this.server.listen(this.testSock, () => {
        cluster.isMaster = false;
        Adios.child.init(() => {
          test.ok(true, 'Executed clean callback.');
          return Promise.resolve();
        }, this.testSock);
      });
    },
  },
};

