# Fixed-vault artifact

`fixed-vault.artifact.json` is the default artifact produced by
`contrib/build-a-vault/build.py` in Sapio at
`79ade0ea97db10a95ba4cb9ca744d2bebd834ae4`.

It uses the kit's public teaching identities, regtest, 100,000 satoshis,
a 144-block release delay and a 500-satoshi fee at each step. The terminal
Output-node migration produces exactly the same artifact.

The Electron regression binds synthetic funding, navigates into the pending
contract and reviews its release PSBT. It does not sign or broadcast.
