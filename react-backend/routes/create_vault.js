var express = require('express');
var router = express.Router();
const Client = require('bitcoin-core');
const client = new Client({
  network: 'regtest',
  username: 'btcusr',
  password: '261299cf4f162e6d8e870760ee88b29537617c6aadc45f5ffd249b2309ca47fd',
  port: 18443
});


/* GET users listing. */
router.post('/', function(req, res, next) {
    const {amount:amount, steps:steps, maturity:maturity, step_period:step_period } = req.body;
    console.log(amount, steps, maturity, step_period);
    client.command("create_ctv_vault", amount, steps, maturity, step_period).then((vault) =>
        res.json(vault)
    ).catch(console.log);
});

module.exports = router;
