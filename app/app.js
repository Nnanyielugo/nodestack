'use strict';

const assert = require('assert');
const express = require('express');
const morgan = require('morgan');
const os = require('os');
const https = require('https');
const fs = require('fs');
const redis = require('redis');
const pg = require('pg');
const counter = require('./counter');
const whisper = require('./whisper');

const port = process.env.PORT || 3000;
const redisURL = process.env.REDIS_URL || 'redis://localhost:6379';

const pgUser = process.env.PG_USER || 'pguser';
const pgHost = process.env.PG_HOST || 'localhost';
const pgPassword = process.env.PG_PASSWORD || null;
const pgDB = process.env.PG_DATABASE || 'pgdb';
const pgPort = process.env.PG_PORT || 5432;

console.log('using redis at', redisURL);
console.log('using postgres at', {pgUser, pgHost, pgDB, pgPort});

// ensure we can exit via ctrl-c
process.on('SIGINT', () => {
  console.log('bye\n');
  process.exit();
});


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

/* Connect to DB, retry for a while if necessary */
const connectDB = async () => {
  const ssl = {}

  if (process.env.PG_TLS_CERT_FILE) {
    console.log('connecting to postgres over tls');
  
    assert(process.env.PG_TLS_KEY_FILE, 'PG_TLS_KEY_FILE must be set');
    assert(process.env.PG_TLS_CA_FILE, 'PG_TLS_CA_FILE must be set');

    ssl.cert = fs.readFileSync(process.env.PG_TLS_CERT_FILE).toString(),
    ssl.key = fs.readFileSync(process.env.PG_TLS_KEY_FILE).toString();
    ssl.ca = fs.readFileSync(process.env.PG_TLS_CA_FILE).toString();
  }

  const clientConfig = {
    user: pgUser,
    host: pgHost,
    database: pgDB,
    password: pgPassword,
    port: pgPort,
    ssl
  }

  let retries = 5;
  const retryWait = 5;

  while (true) {
    try {
      const client = new pg.Client(clientConfig);
      await client.connect();
      return client;
    } catch (err) {
      if (--retries <= 0) throw err; // give up
      console.warn(err);
      console.warn(`pg connection failed, will retry in ${retryWait}s, ${retries} attempts left`);
      await sleep(retryWait * 1000);
    }
  }
}

/* init db and create table(s) if not exists */
const initDB = async () => {
  const client = await connectDB();
  const ddl = 'CREATE TABLE IF NOT EXISTS shouts(id SERIAL PRIMARY KEY, text VARCHAR(255) not null)';
  await client.query(ddl);
  return client;
}

// async version of setTimeout
const sleep = (millis) => {
  return new Promise((resolve, _) => {
    setTimeout(resolve, millis);
  });
}

/* init redis client */
const initRedis = async () => {
  // init redis client
  const redisClient = redis.createClient(redisURL);
  redisClient.on('error', (err) => {
    console.error('redis error', err);
    process.exit(1); // just crash, let the orchestrator deal with it
  });
  return redisClient;
}

/* init app */
const init = async () => {
  const redisClient = await initRedis();
  const pgClient = await initDB();

  // setup webapp
  const app = express();
  // middleware
  app.use(morgan('tiny'));
  app.use(express.json());

  // hello
  app.get('/', (req, res) => {
    res.status(200).json({
      host: os.hostname(),
      message: 'Hello!'
    })
  });

  // simple redis based counter app
  app.get('/counter', counter(redisClient));
  app.use('/shout', whisper(pgClient));

  // fallback route, 404
  app.use((req, res) => {
    res.status(404).send('nothing here');
  });

  if (process.env.TLS_CERT_FILE) {
    runSecure(app);
  } else {
    runInsecure(app);
  }
}

init().catch(err => {
  console.error(err);
  process.exit(1);
});
