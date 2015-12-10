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

## API

* `Adios.master.init([path])` - The initialize function for adios masters. Sets
  up a server for IPC with clustered workers. Note: there can be only one.
  * `path` - (optional) The socket path to use. Defaults to /var/run/adios.sock

  Returns a promise that resolves when the server is listening.

* `Adios.child.init(cleanCb[, path])- The initialize function for adios
  children. Sets up a connection to the master. Note: there can be only one per
  process and it mist be running on a child process.
   * `cleanCb` - The method to execute when the master is notifying of a
     shutdown. Must return a promise that resolves when work is done.
   * `path` - (optional) The socket path to use. Defaults to /var/run/adios.sock

   Returns a promise that resolves when the connection with the master has been
   established.

