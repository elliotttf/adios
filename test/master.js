'use strict';
const cluster = require('cluster');
const net = require('net');
const sinon = require('sinon');
const util = require('util');
const Adios = require('../');
const EventEmitter = require('events');


if (!cluster.isMaster) {
  require('./testWorker');
}

module.exports = {
  fail: {
    fromChild(test) {
      cluster.isMaster = false;
      test.expect(1);

      test.throws(() => {
        Adios.master.init();
      }, 'Master initialized from child.');

      test.done();
    },
    twice(test) {
      test.expect(1);

      Adios.master.init(this.testSock)
        .then(() => {
          test.throws(() => {
            Adios.master.init();
          }, 'Master initialized more than once.');

          test.done();
        });
    },
    childFail(test) {
      test.expect(1);

      sinon.stub(net.Server.prototype, 'close', function (cb) {
        test.throws(() => {
          cb();
        }, 'Exception not thrown');

        delete cluster.workers.foo;
        net.Server.prototype.close.restore();
        this.close(test.done);
      });

      Adios.master.init(this.testSock)
        .then(() => {
          cluster.workers.foo = {};
          process.kill(process.pid, 'SIGINT');
        });
    }
  },
  comm: {
    end(test) {
      test.expect(1);

      Adios.master.init(this.testSock)
        .then(() => {
          let conn = net.connect(this.testSock, () => {
            conn.end();
            test.ok(true);
            test.done();
          });
        });
    }
  },
  sigint: {
    noWorkers(test) {
      test.expect(1);

      this.stubs.push(sinon.stub(process, 'exit', code => {
        test.equal(0, code, 'Process did not termincate cleanly');
        test.done();
      }));

      Adios.master.init(this.testSock)
        .then(() => {
          process.kill(process.pid, 'SIGINT');
        });
    },
    workerShutdown(test) {
      test.expect(3);

      this.stubs.push(sinon.stub(process, 'exit', code => {
        delete cluster.workers.foo;
        test.equal(0, code, 'Process did not termincate cleanly');
        test.done();
      }));

      var DummyWorker = function () {
        this.process = {pid: 'foo'};
        EventEmitter.call(this);
      };
      util.inherits(DummyWorker, EventEmitter);
      DummyWorker.prototype.disconnect = function () {
        test.ok(true, 'Disconnect called');
        this.emit('disconnect');
      };
      cluster.workers.foo = new DummyWorker();

      Adios.master.init(this.testSock)
        .then(() => {
          let conn = net.connect(this.testSock, () => {
            conn.write('pid:foo', () => {
              this.clock.restore();
              setTimeout(() => {
                this.clock = sinon.useFakeTimers();
                process.kill(process.pid, 'SIGINT');
              }, 10);
            });
          });
          conn.on('data', msg => {
            test.equal('SIGINT', msg.toString(), 'SIGINT not announced.');
          });
        });
    },
    workerTimeout(test) {
      test.expect(3);

      this.stubs.push(sinon.stub(process, 'exit', code => {
        delete cluster.workers.foo;
        test.equal(0, code, 'Process did not termincate cleanly');
        test.done();
      }));

      var DummyWorker = function () {
        this.process = {pid: 'foo'};
        EventEmitter.call(this);
      };
      util.inherits(DummyWorker, EventEmitter);
      DummyWorker.prototype.disconnect = function () {
        test.ok(true, 'Disconnect called');
        this.clock.tick(10000);
      }.bind(this);
      DummyWorker.prototype.kill = function () {
        test.ok(true, 'Kill called');
      };
      cluster.workers.foo = new DummyWorker();

      Adios.master.init(this.testSock)
        .then(() => {
          let conn = net.connect(this.testSock, () => {
            conn.write('pid:foo', () => {
              this.clock.restore();
              setTimeout(() => {
                this.clock = sinon.useFakeTimers();
                process.kill(process.pid, 'SIGINT');
              }, 10);
            });
          });
        });
    }
  },
  sigterm(test) {
    test.expect(2);

    this.stubs.push(sinon.stub(process, 'exit', code => {
      test.equal(0, code, 'Process did not termincate cleanly');
      test.done();
    }));

    var DummyWorker = function () {
      this.process = {pid: 'foo'};
      EventEmitter.call(this);
    };
    util.inherits(DummyWorker, EventEmitter);
    DummyWorker.prototype.kill = function () {
      test.ok(true, 'Kill called');
    };
    cluster.workers.foo = new DummyWorker();
    Adios.master.init(this.testSock)
      .then(() => {
        process.kill(process.pid, 'SIGTERM');
      });
  }
};

