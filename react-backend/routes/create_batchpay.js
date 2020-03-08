var express = require('express');
var router = express.Router();
const Client = require('bitcoin-core');
const client = new Client({
    version: '0.15.1',
    network: 'regtest',
    username: 'btcusr',
    password: '261299cf4f162e6d8e870760ee88b29537617c6aadc45f5ffd249b2309ca47fd',
    port: 18443
});
// custom shim!
client.methods.sendmanycompacted =  { features: {}, supported: true };


/* GET users listing. */
router.post('/', function(req, res, next) {
    const {amounts, radix, gas, pairing_mode} = req.body;
    console.log(amounts, radix, gas, pairing_mode);
    client.command("sendmanycompacted", {amounts, radix, gas, pairing_mode}).then((vault) =>
        res.json(vault)
    ).catch(console.log);
});

module.exports = router;
