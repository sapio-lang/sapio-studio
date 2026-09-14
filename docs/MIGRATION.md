# Studio modernization

The supported application path is now the module patch editor, artifact
inspection and selected-spend completion. It uses a fixed typed desktop bridge
to current Sapio commands, without an unrestricted renderer command runner.

The old application used Create React App 4, Electron 17, mismatched React
types, an obsolete BitcoinJS transaction model and an embedded Rust Miniscript
compiler. It sent removed fields to Sapio and coupled compilation to binding.
The maintained build uses Vite, current React/Electron, TypeScript, ReactFlow,
a locked npm dependency graph and checks against a reviewed Sapio revision.

Compilation returns raw module results. `contract explain` supplies validated
artifact occurrences and graph edges, with JSON-pointer locations distinguishing
reused source paths. Spend operations retain the original artifact and immutable
intent separately from the current PSBT; Sapio verifies imported responses and
final witnesses. Binding requires an explicit source and runtime configuration.

Historical wallet sending/monitoring, chat, timing simulation, automatic emulator
startup and the standalone 2022 Miniscript lab are retired from this application.
Their implementation remains in repository history. This release does not
attempt to migrate the old bound-program-only JSON into a trusted current
artifact: recompile original contract sources with current Sapio, then import
the resulting raw artifact. Existing external files are not modified at startup.

## Remaining release work

The source developer preview still needs signed/notarized platform packages,
release ownership and a compatibility policy before a supported distribution.
A focused review of desktop/IPC, schema processing, module provenance and signing
workflows remains necessary. Passing regression checks is not an independent
security audit. Windows distribution is not claimed by the current CI matrix.

Typed module-reference metadata in Sapio would allow stronger static checking of
nested API connections. Additional scheduling or visual control-flow constructs
should be built on explicit module semantics rather than inferred from arbitrary
JSON Schemas. Signing and chain execution remain distinct from visual authoring.
