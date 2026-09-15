# Typed visual patches

A patch contains typed values, module calls and connections, with an explicit
output and one Sapio compilation context. Module hashes identify exact WASM
bytes. Opening a patch reads its interface metadata; execution starts only when
you evaluate a value or compile the designated output.

## Nodes and inputs

| Node      | Supplies                                                                                 | Runs WASM?                         |
| --------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| Variable  | A named value with an explicitly selected type                                           | No                                 |
| Parameter | A named input to a reusable patch, with an optional default                              | No                                 |
| Module    | Its evaluated result, or its callable implementation through a separate reference outlet | When its result is evaluated       |
| Subpatch  | A record containing its declared named outputs                                           | Through its contained module nodes |

A Variable keeps its declared type when you edit its value. It can feed several
inputs. Extracting a local input into a Variable preserves the value and lets
you share it; the value is validated against the Variable's type before use.

Each destination input has one source. A connection removes the local value at
that input, and disconnecting it leaves the input unset. Connecting a whole
record owns its fields; connecting individual fields leaves the others editable.
Two connections cannot own overlapping paths. Lists are values with an item type;
wire a whole list or produce it with a composer instead of making holes in it.

Missing values are distinct from `null`, zero, empty strings and empty lists.
Studio seeds only declared defaults and constants. It does not select the first
enum alternative or invent a public key or amount. A required field without a
value stays unset until supplied. Module input validation decides whether an
optional field may be omitted.

## Types and callable interfaces

Socket names describe a role, such as **Trigger**. Their types describe what can
fill it, such as **Authorization**. A field title does not rename its type.

Modules export ordinary JSON Schemas with three Sapio annotations:

- `x-sapio-type` identifies a domain type, such as `bitcoin.satoshis` or
  `sapio.authorization`. The identity participates in compatibility checks,
  including inside records and lists.
- `x-sapio-module` declares a callable input's expected `arguments` and `returns`
  schema nodes. Their local references resolve in the containing API schema,
  allowing recursive callable types to share definitions. The arguments schema
  includes the complete Sapio invocation envelope and its compilation context.
- `x-sapio-role: "contract"` identifies a compiled contract result for presentation.

A value wire requires compatible declared types. Different semantic identities
are different types even when both serialize as integers or strings. Matching
structures with different numeric bounds, string constraints or list bounds can
connect with **Checked when built** status. Studio validates the actual value
against the destination field before invoking its consumer, then validates the
consumer's complete arguments and result. It does not coerce values.

A module-reference wire supplies:

```json
{ "which_plugin": { "HashKey": "the exact module hash" } }
```

The consumer supplies the call arguments through Sapio's host API. The referenced
node's local argument editor does not configure that call, and referring to a
module does not first evaluate its result.

A value can itself contain a typed callable reference. Connect that node's
value output with a value wire. Studio evaluates the producing module or reads
the Variable or Parameter, then checks the returned exact module hash against
the consumer's expected interface. The separate module-reference outlet always
passes the source Module node's own implementation without evaluating it.

Callable interfaces require exact schema equivalence, including their semantic
identities and validation constraints. Local definition names and documentation
may differ. Productive recursive schemas are supported; unresolved references
and unsupported resource scopes do not establish compatibility. Sapio repeats
interface checking when executing the call. Matching an API describes accepted
inputs and outputs; it does not establish that a contract has the intended
custody behavior.

## Reusable patches

A reusable patch declares Parameter nodes and named outputs. Embedding it creates
a Subpatch node whose input fields are the parameter names and whose result is
a record of named outputs. Parameter defaults apply only when that parameter is
omitted. Unknown inputs are rejected.

For example, a patch can accept `waiting period: Block delay` and export
`vault: Compiled contract`. Its parent connects a Variable to `waiting period`
and selects the `vault` output for compilation. Each embedded instance evaluates
its own values. Every module inherits the outer compilation context; a saved
context inside an imported definition cannot override it.

## Execution and persistence

Build snapshots the graph, nested definitions, exact module APIs, parameter
values and compilation context. Editing while a request is pending cannot change
a later invocation within that run. A node is evaluated once per run and its
results are copied to consumers. Independent inputs and named outputs are visited
in a stable order. Moving nodes or changing their display labels does not alter
arguments or output values.

The designated output is separate from the selected canvas node. Compiling the
patch follows the designation. Evaluating an intermediate node follows that
node's value dependencies. A Subpatch evaluates its declared named outputs and
exposes their record. Connections cannot write to the compilation context.

Patch files use version 2. The minimal shape below is an executable typed value
patch; compilation context is required even when it has no module nodes:

```json
{
    "version": 2,
    "nodes": [
        {
            "id": "delay",
            "kind": "variable",
            "name": "Waiting period",
            "type": {
                "schema": {
                    "type": "integer",
                    "x-sapio-type": "bitcoin.relative-blocks",
                    "minimum": 1,
                    "maximum": 65535
                }
            },
            "value": 144,
            "position": { "x": 80, "y": 80 }
        }
    ],
    "connections": [],
    "outputs": [{ "name": "delay", "node": "delay", "path": "" }],
    "output": "delay",
    "context": { "amount": 100000, "network": "Regtest", "lowering": "Native" }
}
```

A module node uses `kind: "module"`, `moduleKey` and optional `arguments`.
A parameter uses `kind: "parameter"`, `name`, `type` and optional `default`.
A subpatch uses `kind: "subpatch"`, `name`, an embedded `patch` and optional
`arguments`. Every node has an `id` and `position`; optional `label` is purely
for display. A value type may include `root` to retain local schema definitions
when it represents a selected field.

Connections contain `id`, `kind` (`value` or `module`), `source`, `sourcePath`,
`target` and `targetPath`. Paths are JSON Pointers; the empty path selects the
whole value. Output declarations contain `name`, `node` and `path`. `output`
selects a declared name, or is `null` while the patch is still being assembled.

Exports contain public values and module hashes, not key files or signing
authority. Loading requires the referenced modules in the selected workspace;
it does not download code. Version 1 patches must be regenerated using the
current recipe builder.

The editor accepts at most 256 nodes and 1,024 connections per patch, eight
levels of embedded subpatches, and 2,048 nodes and 8,192 connections across the
complete definition. File imports are limited to 8 MiB. Non-finite numbers and
integers outside JavaScript's exact range are rejected. APIs requiring larger
integers must represent them as strings.

Use Inspect to validate a compiled artifact with Sapio, and Spend to complete
an actual spending branch. Raw artifact, intent and PSBT documents remain text;
the graph does not reconstruct them through JavaScript numeric values.
