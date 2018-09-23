'use strict';

const assert = require('assert');
const express = require('express');
const morgan = require('morgan');
const os = require('os');
const https = require('https');
const fs = require('fs');
const redis = require('redis');
const {promisify} = require('util');

// validate env
assert(process.env.PORT, 'PORT must be set');
assert(process.env.TLS_CERT_FILE, 'TLS_CERT_FILE must be set');
assert(process.env.TLS_KEY_FILE, 'TLS_KEY_FILE must be set');
assert(process.env.TLS_CA_FILE, 'TLS_CA_FILE must be set');
assert(process.env.REDIS_URL, 'REDIS_URL must be set');

const port = process.env.PORT;
const certFile = process.env.TLS_CERT_FILE;
const keyFile = process.env.TLS_KEY_FILE;
const caFile = process.env.TLS_CA_FILE;

// booting, so using blocking calls is OK
var tlsOpts = { 
    key: fs.readFileSync(keyFile), 
    cert: fs.readFileSync(certFile), 
    ca: fs.readFileSync(caFile),
    requestCert: true, 
    rejectUnauthorized: true
}; 

// ensure we can exit via ctrl-c when in a container
process.on('SIGINT', () => {
    console.log('bye\n');
    process.exit();
});

const redisClient = redis.createClient(process.env.REDIS_URL);
redisClient.on('error', (err) => {
  console.error('Something went wrong ', err);
  process.exit(1);
});

// redis primisified wrappers and utility functions
const rGet = promisify(redisClient.get.bind(redisClient));
const rSet = promisify(redisClient.set.bind(redisClient));

const rGetInt = async (key) => {
    let val = await rGet(key);
    return parseInt(val);
}

const rSetInt = async (key, val) => {
    return rSet(key, val.toString());
}

// demo webapp
const app = express();
app.use(morgan('tiny'));

app.get('/', async (req, res) => {
    try {
        const cnt = (await rGetInt('counter')) || 1;
        await rSetInt('counter', cnt + 1);
        res.status(200).json({
            host: os.hostname(),
            message: 'Hello!',
            counter: cnt
        });
    } catch (err) {
        res.status(500).json({error: err.toString()})
    }
});

app.use((req, res) => {
    res.status(404).send('nothing here');
});

https.createServer(tlsOpts, app).listen(port, () => {
    console.log('SSL :%s', port);
});
