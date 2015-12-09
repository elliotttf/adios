var cluster = require('cluster');
var Adios = require('../');

module.exports = {
  fail: {
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
  }
};

