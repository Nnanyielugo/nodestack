'use strict';

const assert = require('assert');
const express = require('express');
const morgan = require('morgan');
const os = require('os');
const https = require('https');
const fs = require('fs');
const redis = require('redis');
const counter = require('./counter');

const port = process.env.PORT || 3000;
const redisURL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log('using redis at',redisURL);

/** run application with TLS */
const runSecure = (app) => {
  console.log("starting with tls");

  assert(process.env.TLS_CERT_FILE, 'TLS_CERT_FILE must be set');
  assert(process.env.TLS_KEY_FILE, 'TLS_KEY_FILE must be set');
  assert(process.env.TLS_CA_FILE, 'TLS_CA_FILE must be set');
  
  const certFile = process.env.TLS_CERT_FILE;
  const keyFile = process.env.TLS_KEY_FILE;
  const caFile = process.env.TLS_CA_FILE;
  
  // booting, so using blocking calls is OK
  const tlsOpts = { 
    key: fs.readFileSync(keyFile), 
    cert: fs.readFileSync(certFile), 
    ca: fs.readFileSync(caFile),
    requestCert: true, 
    rejectUnauthorized: true
  };
  https.createServer(tlsOpts, app).listen(port, () => {
    console.log('accepting ssl connections on port %s', port);
  });
}

/** run app without TLS */
const runInsecure = (app) => {
  console.log("starting without tls");
  app.listen(port, () => {
    console.log('accepting connections on port %s', port);
  });
}

// ensure we can exit via ctrl-c
process.on('SIGINT', () => {
  console.log('bye\n');
  process.exit();
});

// init redis client
const redisClient = redis.createClient(redisURL);
redisClient.on('error', (err) => {
  console.error('Something went wrong ', err);
  process.exit(1);
});

// setup webapp
const app = express();

// middleware
app.use(morgan('tiny'));

// hello
app.get('/', (req, res) => {
  res.status(200).json({
    host: os.hostname(),
    message: 'Hello!'
  })
});

// simple redis based counter app
app.get('/counter', counter(redisClient));

// fallback route, 404
app.use((req, res) => {
  res.status(404).send('nothing here');
});


if (process.env.TLS_CERT_FILE) {
  runSecure(app);
} else {
  runInsecure(app);
}
