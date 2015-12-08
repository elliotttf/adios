var child = require('child_process');
var cluster = require('cluster');
var Adios = require('../');

module.exports = {
  setUp: function (cb) {
    this.origMaster = cluster.isMaster;
    cb();
  },
  tearDown: function (cb) {
    cluster.isMaster = this.origMaster;
    cb();
  },
  fail: {
    master: {
      fromChild: function (test) {
        cluster.isMaster = false;
        test.expect(1);

        test.throws(function () {
          Adios.master.init();
        }, 'Master initialized from child.');

        test.done();
      },
      twice: function (test) {
        test.expect(1);

        Adios.master.init();

        test.throws(function () {
          Adios.master.init();
        }, 'Master initialized more than once.');

        test.done();
      }
    },
    child: {
      setUp: function (cb) {
        cluster.isMaster = false;
        cb();
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
        test.expect(1);

        Adios.child.init(console.log);

        test.throws(function () {
          Adios.child.init(console.log);
        }, 'Child initialized more than once.');

        test.done();
      }
    }
  },
  success: function (test) {
    test.expect(1);

    var cp = child.exec('node ' + require('path').join(__dirname, 'server.js'), function (err, stdout) {
      console.log(err);
      console.log(stdout.toString());
      test.equal('exiting child', stdout.toString());
      test.done();
    });

    cp.kill('SIGINT');
  }
};

