const {promisify} = require('util');

module.exports = (redisClient) => {

  // promisified redis wrappers and utility functions
  const rGet = promisify(redisClient.get.bind(redisClient));
  const rSet = promisify(redisClient.set.bind(redisClient));

  const rGetInt = async (key) => {
    let val = await rGet(key);
    return parseInt(val);
  }
  const rSetInt = async (key, val) => {
    return rSet(key, val.toString());
  }

  return async (req, res) => {
    try {
      const cnt = (await rGetInt('counter')) || 1;
      await rSetInt('counter', cnt + 1);
      res.status(200).json({
        counter: cnt
      });
    } catch (err) {
      res.status(500).json({error: err.toString()})
    }
  }
}
