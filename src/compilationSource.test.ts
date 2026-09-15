import Ajv from 'ajv';
import { describe, expect, it, vi } from 'vitest';
import artifact from '../public/demo/starter-artifact.json';
import type {
    JsonObject,
    JsonSchema,
    JsonValue,
    ModuleInfo,
    StudioAPI,
} from '../shared/studio';
import type { Patch, PatchInvocation } from './patching/engine';
import {
    applyProposal,
    findActionOrigins,
    runCompilation,
    sameJsonValue,
    type CompilationSource,
} from './compilationSource';

const actionPath = 'payment/@action/pay/@suggested';
const contract = artifact as JsonObject;
const moduleKey = '11'.repeat(32);
const context: JsonObject = {
    network: 'Regtest',
    effects: {
        effects: {
            [actionPath]: {
                request_000001: { amount_sats: 6000 },
                request_000003: null,
            },
            other: { existing: true },
        },
    },
};
const source = (): CompilationSource => ({
    kind: 'module',
    key: moduleKey,
    args: { arguments: { retained: true }, context: structuredClone(context) },
    result: structuredClone(contract),
});

function patchSource(
    trace: PatchInvocation[],
    patch: Patch = { version: 2, nodes: [], connections: [] },
): CompilationSource {
    return {
        kind: 'patch',
        recipe: { patch, context: {}, outputNode: 'result', trace },
    };
}

function invocation(
    nodePath: string[],
    result: JsonValue,
    ctx: JsonValue = context,
): PatchInvocation {
    return {
        nodePath,
        moduleKey,
        args: { arguments: {}, context: structuredClone(ctx) },
        result,
    };
}

describe('action compilation sources', () => {
    it('matches exact returned contract objects independently of property order', () => {
        const saved = source();
        const reordered = Object.fromEntries(
            Object.entries(contract).reverse(),
        );
        expect(
            findActionOrigins(saved, JSON.stringify(reordered), actionPath),
        ).toEqual([{ id: 'module', moduleKey, context }]);
        expect(
            findActionOrigins(
                saved,
                JSON.stringify({ ...contract, required_input_amount_sats: 1 }),
                actionPath,
            ),
        ).toEqual([]);
        expect(
            findActionOrigins(saved, JSON.stringify(contract), 'other'),
        ).toEqual([]);
        expect(() => findActionOrigins(saved, '"payment"', actionPath)).toThrow(
            'Contract',
        );
    });

    it('returns all producer and passthrough candidates without conflating source paths', () => {
        const traced = patchSource([
            invocation(['producer'], contract),
            invocation(['unrelated'], {
                ...contract,
                required_input_amount_sats: 1,
            }),
            invocation(['nested', 'consumer'], {
                embedded: structuredClone(contract),
            }),
        ]);
        expect(
            findActionOrigins(traced, JSON.stringify(contract), actionPath).map(
                (origin) => origin.nodePath,
            ),
        ).toEqual([['producer'], ['nested', 'consumer']]);
    });

    it('distinguishes unavailable local callbacks from a false JSON schema', () => {
        const value = structuredClone(contract);
        const point = (value.continuation_points as JsonObject)[
            actionPath
        ] as JsonObject;
        point.schema = null;
        const saved = { ...source(), result: value } as CompilationSource;
        expect(
            findActionOrigins(saved, JSON.stringify(value), actionPath),
        ).toEqual([]);
        point.schema = false;
        expect(
            findActionOrigins(saved, JSON.stringify(value), actionPath),
        ).toHaveLength(1);
    });

    it('preserves prior effects and null requests under a fresh deterministic label', () => {
        const saved = source();
        const snapshot = structuredClone(saved);
        const next = applyProposal(saved, 'module', actionPath, null);
        expect(saved).toEqual(snapshot);
        expect(next.kind).toBe('module');
        if (next.kind !== 'module') throw new Error('wrong source');
        const args = next.args as JsonObject;
        expect(args.arguments).toEqual({ retained: true });
        expect(args.context).toEqual({
            ...context,
            effects: {
                effects: {
                    [actionPath]: {
                        request_000001: { amount_sats: 6000 },
                        request_000002: null,
                        request_000003: null,
                    },
                    other: { existing: true },
                },
            },
        });
        const again = applyProposal(next, 'module', actionPath, {
            amount_sats: 7000,
        });
        expect(JSON.stringify(again)).toContain('request_000004');
        expect(() => applyProposal(saved, 'missing', actionPath, null)).toThrow(
            'selected module',
        );
        expect(() => applyProposal(saved, 'module', 'other', null)).toThrow(
            'selected module',
        );
        expect(() =>
            applyProposal(
                saved,
                'module',
                actionPath,
                Number.MAX_SAFE_INTEGER + 1,
            ),
        ).toThrow('exact integer range');
    });

    it('changes only the selected nested invocation context', () => {
        const traced = patchSource([
            invocation(['left', 'producer'], contract, { retained: 'left' }),
            invocation(['right', 'producer'], contract, { retained: 'right' }),
        ]);
        const next = applyProposal(
            traced,
            JSON.stringify(['right', 'producer']),
            actionPath,
            null,
        );
        if (next.kind !== 'patch' || traced.kind !== 'patch')
            throw new Error('wrong source');
        expect(next.recipe.trace[0]).toEqual(traced.recipe.trace[0]);
        expect((next.recipe.trace[1]!.args as JsonObject).context).toEqual({
            retained: 'right',
            effects: { effects: { [actionPath]: { request_000001: null } } },
        });
        expect(traced.recipe.trace[1]!.args).toEqual({
            arguments: {},
            context: { retained: 'right' },
        });
    });

    it('compares structural JSON changes without treating arrays as sets', () => {
        expect(
            sameJsonValue({ a: [1, null], b: true }, { b: true, a: [1, null] }),
        ).toBe(true);
        expect(sameJsonValue([1, 2], [2, 1])).toBe(false);
        expect(sameJsonValue({ a: null }, {})).toBe(false);
        expect(sameJsonValue({ a: [] }, { a: {} })).toBe(false);
    });
});

function apiFor(
    catalog: ModuleInfo[],
    call: (key: string, args: JsonObject) => JsonValue,
) {
    const ajv = new Ajv({ strict: false });
    const validate = (schema: JsonSchema, value: JsonValue) => {
        const check = ajv.compile(schema);
        return {
            valid: check(value),
            errors: (check.errors ?? []).map((error) => error.message ?? ''),
        };
    };
    const modules = {
        call: vi.fn(async ({ key, args }: { key: string; args: string }) =>
            JSON.stringify(call(key, JSON.parse(args))),
        ),
        validate: vi.fn(
            async ({
                key,
                side,
                value,
            }: {
                key: string;
                side: 'arguments' | 'returns';
                value: JsonValue;
            }) =>
                validate(
                    catalog.find((module) => module.key === key)!.api[side],
                    value,
                ),
        ),
        validateValue: vi.fn(
            async ({
                schema,
                value,
            }: {
                schema: JsonSchema;
                value: JsonValue;
            }) => validate(schema, value),
        ),
        list: vi.fn(async () => catalog),
        info: vi.fn(async (key: string) =>
            catalog.find((module) => module.key === key)!,
        ),
    };
    return { api: { modules } as unknown as StudioAPI, modules };
}

const moduleInfo = (
    key: string,
    args: JsonSchema,
    returns: JsonSchema,
): ModuleInfo => ({
    key,
    name: key.slice(0, 4),
    description: '',
    api: {
        arguments: {
            type: 'object',
            properties: { arguments: args, context: { type: 'object' } },
            required: ['arguments', 'context'],
            additionalProperties: false,
        },
        returns,
    },
});

describe('compilation replay', () => {
    it('validates direct module arguments and returns and retains the exact new source', async () => {
        const catalog = [
            moduleInfo(moduleKey, { type: 'object' }, { type: 'object' }),
        ];
        const { api, modules } = apiFor(catalog, (_key, args) => ({
            ...contract,
            applied: args.context!,
        }));
        const next = applyProposal(source(), 'module', actionPath, null);
        const result = await runCompilation(next, api);
        expect(modules.validate.mock.calls.map(([call]) => call.side)).toEqual([
            'arguments',
            'returns',
        ]);
        if (result.source.kind !== 'module') throw new Error('wrong source');
        expect(result.source.result).toEqual(JSON.parse(result.text));
        expect(result.source.args).toEqual(next.kind === 'module' && next.args);
        expect(next.kind === 'module' && next.result).toEqual(contract);
        modules.validate.mockResolvedValueOnce({
            valid: false,
            errors: ['invalid input'],
        });
        await expect(runCompilation(next, api)).rejects.toThrow(
            'invalid input',
        );
        expect(modules.call).toHaveBeenCalledTimes(1);
        modules.call.mockResolvedValueOnce('42');
        await expect(runCompilation(next, api)).rejects.toThrow(
            'violates its advertised API',
        );
    });

    it('replays nested nodes with their own previous contexts and a refreshed trace', async () => {
        const contractType: JsonSchema = { type: 'object' };
        const joinKey = '22'.repeat(32);
        const catalog = [
            moduleInfo(moduleKey, { type: 'object' }, contractType),
            moduleInfo(
                joinKey,
                {
                    type: 'object',
                    properties: { left: contractType, right: contractType },
                    required: ['left', 'right'],
                },
                { type: 'object' },
            ),
        ];
        const subpatch = (): Patch => ({
            version: 2,
            nodes: [
                {
                    kind: 'module',
                    id: 'producer',
                    moduleKey,
                    arguments: {},
                    position: { x: 0, y: 0 },
                },
                {
                    kind: 'output',
                    id: 'output',
                    name: 'contract',
                    position: { x: 0, y: 0 },
                },
            ],
            connections: [
                {
                    id: 'out',
                    kind: 'value',
                    source: 'producer',
                    sourcePath: '',
                    target: 'output',
                    targetPath: '',
                },
            ],
        });
        const patch: Patch = {
            version: 2,
            nodes: [
                {
                    kind: 'subpatch',
                    id: 'left',
                    name: 'Left',
                    patch: subpatch(),
                    arguments: {},
                    position: { x: 0, y: 0 },
                },
                {
                    kind: 'subpatch',
                    id: 'right',
                    name: 'Right',
                    patch: subpatch(),
                    arguments: {},
                    position: { x: 0, y: 0 },
                },
                {
                    kind: 'module',
                    id: 'join',
                    moduleKey: joinKey,
                    arguments: {},
                    position: { x: 0, y: 0 },
                },
                {
                    kind: 'output',
                    id: 'result',
                    name: 'result',
                    position: { x: 0, y: 0 },
                },
            ],
            connections: [
                {
                    id: 'left-join',
                    kind: 'value',
                    source: 'left',
                    sourcePath: '/contract',
                    target: 'join',
                    targetPath: '/left',
                },
                {
                    id: 'right-join',
                    kind: 'value',
                    source: 'right',
                    sourcePath: '/contract',
                    target: 'join',
                    targetPath: '/right',
                },
                {
                    id: 'join-result',
                    kind: 'value',
                    source: 'join',
                    sourcePath: '',
                    target: 'result',
                    targetPath: '',
                },
            ],
        };
        const traced = patchSource(
            [
                invocation(['left', 'producer'], contract, {
                    note: 'left',
                    effects: { effects: { prior: { keep: true } } },
                }),
                invocation(['right', 'producer'], contract, { note: 'right' }),
                {
                    ...invocation(
                        ['join'],
                        { left: contract, right: contract },
                        { note: 'join' },
                    ),
                    moduleKey: joinKey,
                },
            ],
            patch,
        );
        const next = applyProposal(
            traced,
            JSON.stringify(['right', 'producer']),
            actionPath,
            null,
        );
        const { api, modules } = apiFor(catalog, (key, args) =>
            key === joinKey
                ? args.arguments!
                : { ...contract, seen_context: args.context! },
        );
        const completed = await runCompilation(next, api);
        expect(modules.info).toHaveBeenCalledTimes(2);
        expect(modules.validateValue).toHaveBeenCalled();
        const calls = modules.call.mock.calls.map(
            ([call]) => JSON.parse(call.args) as JsonObject,
        );
        expect(calls.map((call) => (call.context as JsonObject).note)).toEqual([
            'left',
            'right',
            'join',
        ]);
        expect(calls[0]!.context).toEqual({
            note: 'left',
            effects: { effects: { prior: { keep: true } } },
        });
        expect(calls[1]!.context).toEqual({
            note: 'right',
            effects: { effects: { [actionPath]: { request_000001: null } } },
        });
        expect(calls[2]!.context).toEqual({ note: 'join' });
        if (completed.source.kind !== 'patch') throw new Error('wrong source');
        expect(
            completed.source.recipe.trace.map((entry) => entry.nodePath),
        ).toEqual([['left', 'producer'], ['right', 'producer'], ['join']]);
        expect(completed.source.recipe.trace[1]!.result).toEqual({
            ...contract,
            seen_context: calls[1]!.context,
        });
        expect(JSON.parse(completed.text).right.seen_context).toEqual(
            calls[1]!.context,
        );
        expect(
            traced.kind === 'patch' &&
                (traced.recipe.trace[1]!.args as JsonObject).context,
        ).toEqual({ note: 'right' });
    });
});
