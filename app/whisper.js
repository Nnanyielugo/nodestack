const express = require('express');

module.exports = (pg) => {

  const r = express.Router();

  r.post('/', async (req, res) => {
    try {
      if (!req.body.text) {
        res.status(400).json({error: "Missing .text"});
        return
      }

      const q = 'insert into shouts(text) values ($1) returning *';
      const r = await pg.query(q, [req.body.text]);
      res.status(201).json({item: r.rows[0]});
    } catch (err) {
      res.status(500).json(errResponse(err));
    }
  });

  r.get('/', async (req, res) => {
    try {
      const r = await pg.query('select id, text from shouts');
      res.status(200).json({items: r.rows});
    } catch (err) {
      res.status(500).json(errResponse(err));
    }
  });

  return r;
}

const errResponse = (err) => {
  return {error: err.toString()};
}
