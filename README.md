# Sapio Studio

A visual workbench for composing Sapio modules, inspecting contract graphs and
completing explicitly selected spends.

- **Patch:** connect module outputs to compatible JSON inputs, or pass module
  references into Sapio's nested calls. Wire results into named Output terminals,
  and save the canvas with its exact module hashes and compilation context.
- **Inspect:** open current raw artifacts and explore the graph validated by
  Sapio, including named outputs, transaction proposals, fee constraints and
  covenant assumptions. Bind the graph, follow linked transactions, and generate
  proposals from a contract's advertised actions.
- **Spend:** prepare an intent, exchange signing requests and responses, resume
  from files, and finalize through Sapio's checked completion API.

Studio opens without Bitcoin Core or an emulator. Runtime configuration is
needed only for explicit binding. Private keys are selected in native dialogs
and remain outside the renderer.

![A real nested WASM call wired and built in Sapio Studio](docs/images/studio-patch.png)

## Run Studio

Use Node 24 (the version in `.nvmrc`) and npm:

```sh
npm ci
npm run build
npm start
```

For development, `npm run dev` starts Vite and Electron together. Renderer edits
reload automatically; restart the command after changing desktop code.
`npm run dev:web` opens the renderer in a browser for layout development and
read-only preview; desktop file access, compilation and signing use Electron.

Open Settings and select your Sapio CLI executable. Studio requires the current
file-based CLI and Program signer, tested at Sapio revision
[`9533a62ecb6f639d6f3cd4a552c63ade902e7618`](https://github.com/sapio-lang/sapio/commit/9533a62ecb6f639d6f3cd4a552c63ade902e7618)
with typed module interfaces. The historical crates.io CLI does not expose
this API. Build the reviewed source with:

```sh
git clone https://github.com/sapio-lang/sapio.git sapio-core
cd sapio-core
git checkout 9533a62ecb6f639d6f3cd4a552c63ade902e7618
cargo build --locked -p sapio-cli
```

Choose `sapio-core/target/debug/sapio-cli` in Studio, or set `SAPIO_CLI_BINARY`
to its absolute path before starting the desktop. The connection check probes
the required commands, because an old and a new CLI may share a version label.

## Try visual composition

Choose **Open example patch** to load and connect the bundled **GetClause** and
**Wrapper** modules. Alice and Bob are named public-key Variables; the
dashed connection supplies the callable implementation. Choose **Build output**
to evaluate the named `policy` output. Sapio executes the real nested WASM
call; the result can be reviewed and exported. The bundled module sources and
checksums are recorded in [the example notes](public/demo/README.md).

Click a module input to enter a structured value, create a matching Variable,
or find compatible outputs and building blocks. Each input shows its source.
Use **Expose as parameter** for reusable inputs. Add an **Output** terminal,
name it, and connect the value to export. Save the patch and choose
**Import reusable patch** in another program.

You can also load your own `.wasm` modules and connect their advertised APIs.
See [visual patch semantics](docs/PATCHING.md) for the distinction between value
connections and module references, validation, and the current type limits.
Contract Output terminals use **Build output** and open Inspect automatically.
Compilation uses the public network, amount and lowering context shown in the
editor. Binding and signing are separate actions.

For a complete contract, use the current CLI's `sapio-cli new` tutorial, then
open its `artifact.json` in Studio. Its `funded.psbt`, `assets.json` and
`evidence.json` feed the Spend view. Save the unchanged artifact and intent
alongside the newest PSBT to resume later. The built-in inspection preview and
starter use synthetic funding and public demonstration keys.

## Follow a contract into a spend

Inspect labels the graph **Unbound template graph** until you choose **Bind graph**.
Select a runtime configuration, then choose synthetic preview funding, a funding
outpoint, or a funding PSBT. The resulting graph retains its linked outpoints and
PSBTs. **Mock-bound preview** is explicitly synthetic; **Bound to supplied funding**
does not establish confirmation, unspent status, or complete auxiliary funding.
Exporting the bound graph is a separate action.

Click a contract output to see its next transactions. Transaction allocations
link to their receiving contracts; each child links back to its creating
transaction. Select **Review spend** on a linked transaction to carry its exact
contract occurrence and PSBT into Spend. Studio checks available spending paths;
choose the path, prepare an intent, and collect its required authorizations.
Rebinding clears the previous spend selection. Binding may request configured
covenant-emulator attestations; it does not broadcast transactions.

Contracts built in Studio retain their compilation inputs for **Generate proposal**.
This action validates the request and replays the saved compilation, with effects
scoped to the selected module invocation. Where several steps return the same
contract, choose the step that creates it. A successful proposal opens a new,
unbound graph; an error or unchanged result keeps the existing graph. Editing
the patch marks an inspected build as an older snapshot. Imported raw artifacts
can be bound and spent, but their JSON does not include the builder needed for
proposal generation. Raw artifact and bound-program exports do not persist that
in-memory compilation source.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run test:ui
```

The desktop tests launch the actual production Electron build with an isolated
user-data directory. Linux CI uses Xvfb. To run the real Sapio integration suite,
set `SAPIO_CLI` to the absolute CLI binary and `SAPIO_MODULES` to this checkout's
`public/demo` directory, then run `npm run test:sapio`. The suite creates a
standalone pinned starter with Cargo, completes its synthetic spend, and checks
real nested WASM composition and explicit mock binding. `CARGO_TARGET_DIR` can
reuse an existing Rust build cache.

With `SAPIO_CLI` set, `npm run test:ui` also builds a real visual patch, saves it,
reopens it in a fresh desktop process, and rebuilds from the cached module APIs.
It also binds a Fixed Vault with synthetic funding and reviews a child release
transaction through the real Sapio spend planner. Canvas regressions check that
navigation retains the viewport and never briefly hides existing nodes.
Cold module loading with a debug CLI can take tens of seconds; the desktop shows
the operation in progress while Sapio compiles the WASM.

CI checks Node 24 builds, tests and production desktop startup on Linux and
macOS, plus a pinned Sapio integration job. See [the migration notes](docs/MIGRATION.md)
for the intentionally retired historical surfaces and remaining release work.
