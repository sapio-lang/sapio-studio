# Built-in examples

The two WASM modules are generated from Sapio revision
`d385c79e1acb78c42a538f7c503b52efe739ed66` with Rust 1.98.1. `modules.json` records
SHA-256 checksums of the bundled WASM; Sapio independently computes its module
cache identities when loading the bytes. `module-apis.json` contains the schemas
returned by the actual CLI for those modules.

The module sources are Sapio's `plugin-example/clause-module` and
`plugin-example/clause-module-trampoline`, under its MPL-2.0 license. Rebuild in
the pinned Sapio checkout:

```sh
cargo build --manifest-path plugin-example/Cargo.toml --locked --release \
  --target wasm32-unknown-unknown \
  -p sapio-wasm-clause -p sapio-wasm-clause-trampoline
```

This guest build needs LLVM Clang with the wasm32 target. Copy the two resulting
WASM files from the plugin workspace's target directory and refresh checksums
and schemas. Build paths may affect bytes, so the checksums identify the shipped
files rather than claiming reproducible bytes across all build environments.

`starter-artifact.json` and `starter-explanation.json` were generated at Sapio
revision `b6a03c452463a3500dd0d84f3b853d9bc78ef68c` using `sapio-cli new`
and its default synthetic payment. The integration suite regenerates and checks
both against the pinned CLI. Funding and keys in that tutorial are public demo
material. Studio's preview does not fund or broadcast a transaction.
