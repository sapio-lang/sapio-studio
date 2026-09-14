# Visual patch semantics

A patch is a versioned JSON document containing positioned module nodes, their
arguments, connections and one explicit Sapio compilation context. Module hashes
identify the exact cached WASM. Opening a patch does not execute it.

## Value connections

A value connection reads a JSON Pointer from a source result and supplies it to
a destination argument. Studio offers ports from the advertised input and
output JSON Schemas and conservatively checks compatibility before accepting a
wire. Unknown or unsupported schema relationships do not receive a compatibility
claim. Actual values are validated again against each module's complete input
and output schema during execution, and Sapio checks the module invocation.

Build evaluates the selected node's value dependencies first, once per node,
using a snapshot of the patch and context. Argument edits cannot change an
invocation already in progress. Cycles, missing modules and overlapping writers
to the same destination are rejected. Connections cannot overwrite compilation
context. A build result is data; it is not necessarily a compiled contract.

## Module references

A reference connection supplies `{ "which_plugin": { "HashKey": "..." } }`
into an existing `SapioHostAPI` argument. The consumer chooses the arguments and
context for its nested call through Sapio's host API. The referenced node's
argument editor is not evaluated for that connection. The clause example runs
Wrapper, which calls GetClause inside the WASM host.

Current Sapio handle schemas omit their generic argument and return types.
Studio therefore labels these sockets as checked when called, not statically
proven compatible. A future typed-handle schema can strengthen this boundary
without changing the distinction between passing values and passing modules.

## Persistence and limits

Patch exports contain module hashes, topology, positions, arguments and context;
they contain no key files or signing authority. Loading a patch requires its
modules in the selected workspace. File import does not fetch or execute code.

The editor rejects non-finite numbers and integers outside JavaScript's exact
integer range. Raw artifact, intent and PSBT documents are carried separately as
text and are not reconstructed from the visual graph. JSON Schema compatibility
is intentionally conservative; the canvas is not a general subtype theorem
prover or an independent Bitcoin policy evaluator.

Use Inspect to validate a compiled artifact with Sapio. Use Spend to select and
complete an actual spending branch. A graph connection or successful compilation
does not provide signatures, Bitcoin confirmations or covenant activation.
