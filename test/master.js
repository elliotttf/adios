'use strict';
const cluster = require('cluster');
const sinon = require('sinon');
const Adios = require('../');

module.exports = {
  fail: {
    fromChild(test) {
      cluster.isMaster = false;
      test.expect(1);

      test.throws(() => {
        Adios.master.init();
      }, 'Master initialized from child.');

      test.done();
    }/*,
    twice(test) {
      test.expect(1);

      Adios.master.init()
        .then(() => {
          test.throws(() => {
            Adios.master.init();
          }, 'Master initialized more than once.');

          test.done();
        });
    }*/
  },
  sigterm(test) {
    test.expect(1);

    this.stubs.push(sinon.stub(process, 'exit', code => {
      test.equal(0, code, 'Process did not termincate cleanly');
      test.done();
    }));

    Adios.master.init()
      .then(() => {
        process.kill(process.pid, 'SIGTERM');
      });
  }
};

