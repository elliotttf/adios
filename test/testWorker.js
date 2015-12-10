'use strict';
const Adios = require('../');

Adios.child.init(() => {
  return Promise.resolve();
}, process.env.testSock);

