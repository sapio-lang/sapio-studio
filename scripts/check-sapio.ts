import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createSapioBridge } from '../desktop/bridge';
import { runCli } from '../desktop/cli';
import type { JsonValue, StudioSettings } from '../shared/studio';
import { clauseTrampolinePatch } from '../src/patching/demo';
import { runPatch } from '../src/patching/engine';

const cli = process.env.SAPIO_CLI;
const modules = process.env.SAPIO_MODULES;
assert(
    cli && path.isAbsolute(cli),
    'Set SAPIO_CLI to the absolute path of the current sapio-cli.',
);
assert(
    modules && path.isAbsolute(modules),
    'Set SAPIO_MODULES to the directory containing the clause and trampoline WASM modules.',
);

const temporary = await mkdtemp(path.join(tmpdir(), 'studio-integration-'));
try {
    const project = path.join(temporary, 'contract');
    await runCli(cli, ['new', project, '--name', 'studio-integration']);
    await promisify(execFile)(
        'cargo',
        ['run', '--locked', '--', 'build', 'demo'],
        {
            cwd: project,
            timeout: 1_200_000,
            maxBuffer: 4 * 1024 * 1024,
            env: {
                ...process.env,
                CARGO_BUILD_JOBS: '2',
                CARGO_PROFILE_DEV_DEBUG: '0',
                CARGO_INCREMENTAL: '0',
            },
        },
    );
    const demo = path.join(project, 'demo');
    const read = (name: string) => readFile(path.join(demo, name), 'utf8');
    const settings: StudioSettings = {
        cliPath: cli,
        workspace: path.join(temporary, 'modules'),
        runtimeConfig: path.join(
            temporary,
            'deliberately-missing-runtime.json',
        ),
    };
    let selectedModule = path.join(modules, 'sapio_wasm_clause.wasm');
    const bridge = createSapioBridge({
        settings: async () => settings,
        temporaryDirectory: path.join(temporary, 'requests'),
        schemaWorker: path.resolve('dist/desktop/schema-worker.cjs'),
        exampleModules: [
            path.join(modules, 'sapio_wasm_clause.wasm'),
            path.join(modules, 'sapio_wasm_clause_trampoline.wasm'),
        ],
        selection: {
            module: async () => selectedModule,
            key: async () => path.join(demo, 'oracle.key'),
            evaluator: async () => path.join(demo, 'pay_at_least.wasm'),
        },
    });
    assert.equal((await bridge.status()).available, true);
    const artifact = await read('artifact.json');
    const explanation = await bridge.explain({ artifact });
    assert.equal(explanation.artifact.nodes[0]?.required_input_sats, 20_000);
    assert.deepEqual(
        explanation,
        JSON.parse(
            await readFile('public/demo/starter-explanation.json', 'utf8'),
        ),
    );
    assert.deepEqual(
        JSON.parse(artifact),
        JSON.parse(await readFile('public/demo/starter-artifact.json', 'utf8')),
    );
    const prepared = await bridge.spend.prepare({
        artifact,
        psbt: await read('funded.psbt'),
        path: 'key',
        assets: await read('assets.json'),
        evidence: await read('evidence.json'),
    });
    // Recreate the caller's documents to exercise a real persisted/resumed session.
    const resume = JSON.parse(
        JSON.stringify({
            artifact,
            intent: prepared.intent,
            psbt: prepared.psbt,
        }),
    );
    const requests = await bridge.spend.requests(resume);
    assert.equal(requests.length, 1);
    await assert.rejects(
        bridge.spend.finalize({ ...resume, transaction: true }),
    );
    const response = await bridge.spend.signProgram({
        request: JSON.stringify(requests[0]!.request),
    });
    assert(response);
    const applied = await bridge.spend.apply({
        ...resume,
        responses: [{ index: 0, psbt: response }],
    });
    const transaction = await bridge.spend.finalize({
        ...resume,
        psbt: applied.psbt,
        transaction: true,
    });
    assert(/^[0-9a-f]+$/.test(transaction) && transaction.length > 100);
    await assert.rejects(
        bridge.spend.apply({
            ...resume,
            responses: [{ index: 1, psbt: response }],
        }),
    );
    console.log(
        'Current CLI: artifact inspection, persisted spend, explicit WASM signing, response import and finalization passed.',
    );

    const [provider, consumer] = await bridge.modules.loadExamples();
    assert(provider);
    assert(consumer);
    assert.equal((await bridge.modules.list()).length, 2);
    const patch = clauseTrampolinePatch(provider.key, consumer.key);
    const runtime = {
        invoke: async (key: string, args: JsonValue): Promise<JsonValue> =>
            JSON.parse(
                await bridge.modules.call({ key, args: JSON.stringify(args) }),
            ),
        validate: (
            key: string,
            side: 'arguments' | 'returns',
            value: JsonValue,
        ) => bridge.modules.validate({ key, side, value }),
    };
    const result = await runPatch(
        patch,
        [provider, consumer],
        'trampoline',
        patch.context,
        runtime,
    );
    const direct = await runtime.invoke(provider.key, {
        arguments: patch.nodes[0]!.arguments,
        context: patch.context,
    });
    assert.deepEqual(result.output, direct);
    assert.deepEqual(result.executed, ['trampoline']);
    const invalid = structuredClone(patch);
    invalid.nodes[1]!.arguments = {
        g: { alice: 'not a key', bob: 'not a key' },
    };
    await assert.rejects(
        runPatch(
            invalid,
            [provider, consumer],
            'trampoline',
            patch.context,
            runtime,
        ),
    );
    console.log(
        'Visual patch: real nested WASM composition agrees with the provider and rejects invalid inputs.',
    );

    const config = path.join(temporary, 'runtime.json');
    await writeFile(
        config,
        JSON.stringify({
            main: null,
            testnet: null,
            signet: null,
            regtest: {
                active: true,
                api_node: {
                    url: 'http://127.0.0.1:1',
                    auth: { CookieFile: '/deliberately/missing/cookie' },
                },
                covenant: { mode: 'native_ctv_research' },
            },
        }),
    );
    settings.runtimeConfig = config;
    const bound = JSON.parse(
        await bridge.bind({ artifact, funding: { kind: 'mock' } }),
    );
    assert(Object.keys(bound.program).length > 0);
    console.log(
        'Explicit mock binding passed without a Bitcoin node or cookie.',
    );
} finally {
    await rm(temporary, { recursive: true, force: true });
}
