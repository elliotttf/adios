'use strict';

const Adios = require('../');

Adios.child.init(() => Promise.resolve(), process.env.testSock);
