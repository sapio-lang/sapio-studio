// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioSettings } from '../shared/studio';
import { createSapioBridge } from './bridge';
import { MAX_DOCUMENT_BYTES, runCli } from './cli';

let root: string;
const key = 'ab'.repeat(32);
const artifact = '{"an": "opaque artifact"}';
beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'studio-bridge-test-'));
});
afterEach(async () => {
    await rm(root, { recursive: true, force: true });
});

function setup(run: typeof runCli, exampleModules?: string[]) {
    const settings: StudioSettings = {
        cliPath: '/selected/sapio-cli',
        workspace: path.join(root, 'modules-workspace'),
        runtimeConfig: '/runtime/config.json',
    };
    const selection = {
        module: vi.fn(async (): Promise<string | null> => null),
        key: vi.fn(async (): Promise<string | null> => null),
        evaluator: vi.fn(async (): Promise<string | null> => null),
    };
    return {
        settings,
        selection,
        bridge: createSapioBridge({
            settings: async () => settings,
            selection,
            temporaryDirectory: root,
            schemaWorker: path.resolve('dist/desktop/schema-worker.cjs'),
            exampleModules,
            run,
        }),
    };
}

describe('fixed Sapio operations', () => {
    it('validates typed values in the schema worker without invoking a WASM module', async () => {
        const run = vi.fn<typeof runCli>();
        const { bridge } = setup(run);
        const schema = {
            type: 'integer',
            minimum: 1,
            maximum: 65535,
            'x-sapio-type': 'sapio.relative-block-delay/v1',
        };
        expect(
            await bridge.modules.validateValue({ schema, value: 144 }),
        ).toEqual({ valid: true, errors: [] });
        expect(
            (await bridge.modules.validateValue({ schema, value: 0 })).valid,
        ).toBe(false);
        expect(
            (await bridge.modules.validateValue({ schema, value: '144' }))
                .valid,
        ).toBe(false);
        expect(run).not.toHaveBeenCalled();
    });
    it('checks the combined document limit before staging files or starting Sapio', async () => {
        const run = vi.fn<typeof runCli>();
        const { bridge } = setup(run);
        // Reuse one bounded document; the operation counts each staged copy.
        const document = 'x'.repeat(MAX_DOCUMENT_BYTES);
        await expect(
            bridge.spend.apply({
                artifact,
                intent: '{}',
                responses: Array.from({ length: 4 }, (_, index) => ({
                    index,
                    psbt: document,
                })),
            }),
        ).rejects.toThrow('Combined operation documents exceed 128 MiB');
        expect(run).not.toHaveBeenCalled();
        expect(await readdir(root)).toEqual([]);
    });
    it('loads only main-configured bundled examples without a renderer path or file picker', async () => {
        const run = vi
            .fn<typeof runCli>()
            .mockImplementation(async (_binary, args) => {
                if (args[1] === 'load') return JSON.stringify({ key });
                if (args[1] === 'info')
                    return JSON.stringify({
                        name: 'Example',
                        description: 'Bundled module',
                    });
                if (args[1] === 'api')
                    return JSON.stringify({ arguments: true, returns: true });
                throw new Error('Unexpected operation');
            });
        await expect(setup(run).bridge.modules.loadExamples()).rejects.toThrow(
            'does not include example modules',
        );
        expect(run).not.toHaveBeenCalled();
        const files = ['/bundle/clause.wasm', '/bundle/trampoline.wasm'];
        const { bridge, selection } = setup(run, files);
        expect(await bridge.modules.loadExamples()).toHaveLength(2);
        expect(
            run.mock.calls
                .filter(([, args]) => args[1] === 'load')
                .map(([, args]) => args.at(-1)),
        ).toEqual(files);
        expect(selection.module).not.toHaveBeenCalled();
    });
    it('compiles a generic module result with unchanged public context and no runtime configuration', async () => {
        const run = vi
            .fn<typeof runCli>()
            .mockResolvedValue('{"Clause":"value"}');
        const { bridge, settings } = setup(run);
        const args =
            '{"arguments":{},"context":{"amount":1000,"network":"Regtest","lowering":"Native"}}';
        expect(await bridge.modules.call({ key, args })).toBe(
            '{"Clause":"value"}',
        );
        expect(run).toHaveBeenCalledExactlyOnceWith(
            settings.cliPath,
            [
                'contract',
                'create',
                '--workspace',
                settings.workspace,
                '--key',
                key,
            ],
            { input: args },
        );
    });
    it('keeps temporary input files private and removes them after CLI rejection', async () => {
        const run = vi
            .fn<typeof runCli>()
            .mockImplementation(async (_binary, args) => {
                const psbt = args[args.indexOf('--psbt') + 1]!;
                expect(await readFile(psbt, 'utf8')).toBe(
                    'original base64 PSBT',
                );
                if (process.platform !== 'win32')
                    expect((await stat(psbt)).mode & 0o777).toBe(0o600);
                throw new Error('artifact validation failed');
            });
        const { bridge } = setup(run);
        await expect(
            bridge.explain({ artifact, psbt: 'original base64 PSBT' }),
        ).rejects.toThrow('artifact validation failed');
        expect(await readdir(root)).toEqual([]);
    });
    it('requires explicit runtime configuration only for explicit binding', async () => {
        const run = vi.fn<typeof runCli>().mockResolvedValue('{}');
        const { bridge, settings } = setup(run);
        settings.runtimeConfig = '';
        await expect(
            bridge.bind({ artifact, funding: { kind: 'mock' } }),
        ).rejects.toThrow('runtime configuration');
        expect(run).not.toHaveBeenCalled();
        settings.runtimeConfig = '/selected/runtime.json';
        await bridge.bind({ artifact, funding: { kind: 'mock' } });
        expect(run).toHaveBeenCalledExactlyOnceWith(
            settings.cliPath,
            ['--config', settings.runtimeConfig, 'contract', 'bind', '--mock'],
            { input: artifact },
        );
    });
    it('does not sign or select an evaluator when the user cancels key selection', async () => {
        const run = vi.fn<typeof runCli>();
        const { bridge, selection } = setup(run);
        const request = JSON.stringify({ instance: { evaluator: key } });
        expect(await bridge.spend.signProgram({ request })).toBeNull();
        expect(run).not.toHaveBeenCalled();
        expect(selection.evaluator).not.toHaveBeenCalled();
    });
    it('uses inline evaluator requests directly and explicitly selects registered evaluator bytes', async () => {
        const run = vi.fn<typeof runCli>().mockResolvedValue('signed PSBT');
        const { bridge, selection, settings } = setup(run);
        selection.key.mockResolvedValue('/private/oracle.key');
        selection.evaluator.mockResolvedValue('/selected/evaluator.wasm');
        for (const evaluator of ['0'.repeat(64), `${'0'.repeat(62)}02`]) {
            const request = JSON.stringify({ instance: { evaluator } });
            expect(await bridge.spend.signProgram({ request })).toBe(
                'signed PSBT',
            );
            expect(run).toHaveBeenLastCalledWith(
                settings.cliPath,
                [
                    'signer',
                    'program',
                    '--request',
                    '-',
                    '--key',
                    '/private/oracle.key',
                ],
                { input: request },
            );
        }
        expect(selection.evaluator).not.toHaveBeenCalled();
        const request = JSON.stringify({ instance: { evaluator: key } });
        await bridge.spend.signProgram({ request });
        expect(run).toHaveBeenLastCalledWith(
            settings.cliPath,
            [
                'signer',
                'program',
                '--request',
                '-',
                '--key',
                '/private/oracle.key',
                '--evaluator',
                '/selected/evaluator.wasm',
            ],
            { input: request },
        );
    });
    it('rejects conflicting response indexes before invoking Sapio and preserves original intent', async () => {
        const run = vi.fn<typeof runCli>();
        const { bridge } = setup(run);
        const input = {
            artifact,
            intent: '{"baseline":"unchanged"}',
            responses: [
                { index: 1, psbt: 'one' },
                { index: 1, psbt: 'two' },
            ],
        };
        await expect(bridge.spend.apply(input)).rejects.toThrow('only once');
        expect(run).not.toHaveBeenCalled();
        expect(input.intent).toBe('{"baseline":"unchanged"}');
    });
});
