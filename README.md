# Adios

[![Build Status](https://travis-ci.org/elliotttf/adios.svg?branch=master)](https://travis-ci.org/elliotttf/adios)
[![Coverage Status](https://coveralls.io/repos/elliotttf/adios/badge.svg?branch=master&service=github)](https://coveralls.io/github/elliotttf/adios?branch=master)

A module for notifying clustered workers for clean shutdowns.

This is accomplished by using [domain sockets](https://en.wikipedia.org/wiki/Unix_domain_socket)
– `/var/run/adios.sock` by default – which has the added benefit of not sending messages over
application specific IPC channels. This means you don't have to filter out messages from adios
in any `process.on('message')` listeners.

_Note_: On Windows, the local domain is implemented using a named pipe. The path must refer to an
entry in `\\?\pipe\` or `\\.\pipe\`. Therefore, you must initialize adios with a path in this space
if you are running on a Windows machine.

## Usage

```javascript
'use strict';
const cluster = require('cluster');
const http = require('http');
const Adios = require('adios');

if (cluster.isMaster) {
  Adios.master.init()
    .then(() => {
      let worker = cluster.fork();
    });
}
else {
  let server = http.createServer();
  Adios.child.init(() => {
    return new Promise(resolve => {
      server.close(resolve);
    });
  })
    .then(() => {
      server.listen(3000);
    });
}
```
