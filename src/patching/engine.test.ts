import Ajv from 'ajv';
import { describe, expect, it, vi } from 'vitest';
import type { JsonSchema, JsonValue, ModuleInfo } from '../../shared/studio';
import {
    checkConnection,
    parsePatch,
    runPatch,
    type Patch,
    type PatchRuntime,
} from './engine';
import { compatibleValues, modulePorts, readPointer } from './schema';

const key = (n: number) => String(n).repeat(64);
const scalar: JsonSchema = { type: 'integer', minimum: 0, maximum: 100 };
const module = (
    n: number,
    args: JsonSchema,
    returns: JsonSchema,
): ModuleInfo => ({
    key: key(n),
    name: `Module ${n}`,
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
const producer = module(1, { type: 'object' }, scalar);
const consumer = module(
    2,
    { type: 'object', properties: { amount: scalar }, required: ['amount'] },
    scalar,
);
const modules = [producer, consumer];
const patch = (): Patch => ({
    version: 1,
    nodes: [
        {
            id: 'a',
            moduleKey: producer.key,
            arguments: {},
            position: { x: 0, y: 0 },
        },
        {
            id: 'b',
            moduleKey: consumer.key,
            arguments: {},
            position: { x: 300, y: 0 },
        },
    ],
    connections: [
        {
            id: 'a-b',
            kind: 'value',
            source: 'a',
            sourcePath: '',
            target: 'b',
            targetPath: '/amount',
        },
    ],
});

function runtime(
    catalog: ModuleInfo[],
    invoke: PatchRuntime['invoke'],
): PatchRuntime {
    const ajv = new Ajv({ strict: false });
    return {
        invoke,
        async validate(moduleKey, side, value) {
            const validator = ajv.compile(
                catalog.find((item) => item.key === moduleKey)!.api[side],
            );
            return {
                valid: validator(value),
                errors: (validator.errors ?? []).map(
                    (error) => error.message ?? '',
                ),
            };
        },
    };
}

describe('executable patches', () => {
    it('refuses unsafe integer arguments, contexts and outputs before forwarding', async () => {
        const unsafe = JSON.parse('9007199254740993') as number;
        const invoke = vi.fn(async () => unsafe);
        const graph = patch();
        graph.nodes[0]!.arguments = { nested: [unsafe] };
        await expect(
            runPatch(graph, modules, 'b', {}, runtime(modules, invoke)),
        ).rejects.toThrow(/exact integer range/);
        expect(invoke).not.toHaveBeenCalled();
        await expect(
            runPatch(
                patch(),
                modules,
                'b',
                { amount: unsafe },
                runtime(modules, invoke),
            ),
        ).rejects.toThrow(/exact integer range/);
        expect(invoke).not.toHaveBeenCalled();
        await expect(
            runPatch(patch(), modules, 'b', {}, runtime(modules, invoke)),
        ).rejects.toThrow(/Module result/);
        expect(invoke).toHaveBeenCalledTimes(1);
        expect(() =>
            parsePatch(
                JSON.stringify({ ...patch(), context: { amount: unsafe } }),
            ),
        ).toThrow(/exact integer range/);
    });
    it('evaluates dependencies once, then copies the result into the destination arguments', async () => {
        const invoke = vi.fn(
            async (moduleKey: string, args: { arguments: JsonValue }) =>
                moduleKey === producer.key
                    ? 42
                    : readPointer(args.arguments, '/amount'),
        );
        const graph = patch();
        const result = await runPatch(
            graph,
            modules,
            'b',
            { amount: 100, network: 'Regtest', lowering: 'Native' },
            runtime(modules, invoke),
        );
        expect(result.output).toBe(42);
        expect(result.executed).toEqual(['a', 'b']);
        expect(invoke.mock.calls[1]![1].arguments).toEqual({ amount: 42 });
        expect(graph.nodes[1]!.arguments).toEqual({});
    });

    it('validates produced values before downstream execution', async () => {
        const invoke = vi.fn(async () => 101);
        await expect(
            runPatch(patch(), modules, 'b', {}, runtime(modules, invoke)),
        ).rejects.toThrow('violates its advertised API');
        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid complete destination inputs before invoking a module', async () => {
        const graph = patch();
        graph.connections = [];
        const invoke = vi.fn(async () => 42);
        await expect(
            runPatch(graph, modules, 'b', {}, runtime(modules, invoke)),
        ).rejects.toThrow('Invalid arguments');
        expect(invoke).not.toHaveBeenCalled();
    });

    it('wires cached module hashes without invoking unused provider parameters', async () => {
        const target = module(
            3,
            {
                type: 'object',
                properties: {
                    v: {
                        type: 'object',
                        properties: {
                            which_plugin: {
                                oneOf: [
                                    {
                                        type: 'object',
                                        properties: {
                                            HashKey: { type: 'string' },
                                        },
                                        required: ['HashKey'],
                                    },
                                ],
                            },
                        },
                        required: ['which_plugin'],
                    },
                },
                required: ['v'],
            },
            { type: 'string' },
        );
        const graph = patch();
        graph.nodes[0]!.arguments = 'not a valid provider invocation';
        graph.nodes[1]!.moduleKey = target.key;
        graph.connections[0] = {
            ...graph.connections[0]!,
            kind: 'module',
            targetPath: '/v',
        };
        const invoke = vi.fn(async () => 'and(pk(alice),pk(bob))');
        const result = await runPatch(
            graph,
            [producer, target],
            'b',
            {},
            runtime([producer, target], invoke),
        );
        expect(result.executed).toEqual(['b']);
        expect(invoke).toHaveBeenCalledWith(target.key, {
            arguments: { v: { which_plugin: { HashKey: producer.key } } },
            context: {},
        });
    });

    it('freezes graph parameters and shared context for the duration of a run', async () => {
        const graph = patch();
        const context = { amount: 100 };
        const invoke = vi.fn(
            async (
                moduleKey: string,
                args: { arguments: JsonValue; context: JsonValue },
            ) => {
                if (moduleKey === producer.key) {
                    context.amount = 999;
                    graph.nodes[1]!.arguments = { injected: true };
                    return 4;
                }
                expect(args).toEqual({
                    arguments: { amount: 4 },
                    context: { amount: 100 },
                });
                return 4;
            },
        );
        await runPatch(graph, modules, 'b', context, runtime(modules, invoke));
    });

    it('rejects duplicate or overlapping inputs, cycles and missing module hashes', async () => {
        const graph = patch();
        expect(
            checkConnection(graph, modules, {
                ...graph.connections[0]!,
                id: 'duplicate',
            }),
        ).toMatch(/already/);
        const rootInput = module(2, scalar, scalar);
        const cyclic = patch();
        cyclic.connections = [
            { ...cyclic.connections[0]!, targetPath: '' },
            {
                id: 'b-a',
                kind: 'value',
                source: 'b',
                sourcePath: '',
                target: 'a',
                targetPath: '',
            },
        ];
        const rootProducer = module(1, scalar, scalar);
        await expect(
            runPatch(
                cyclic,
                [rootInput, rootProducer],
                'b',
                {},
                runtime(modules, vi.fn()),
            ),
        ).rejects.toThrow(/acyclic/);
        await expect(
            runPatch(graph, [producer], 'b', {}, runtime(modules, vi.fn())),
        ).rejects.toThrow(/Missing module/);
    });
});

describe('schema sockets and portable patches', () => {
    const port = (schema: JsonSchema) => ({
        path: '',
        label: 'value',
        kind: 'value' as const,
        schema,
        root: schema,
    });

    it('resolves tuple additional-item schemas within each independent root', () => {
        const tuple = (extra: string): JsonSchema => ({
            type: 'array',
            items: [{ type: 'integer' }],
            additionalItems: { $ref: '#/definitions/Extra' },
            definitions: { Extra: { type: extra } },
        });
        const source = tuple('string');
        const target = tuple('integer');
        const ajv = new Ajv({ strict: false });
        expect(ajv.compile(source)([1, 'extra'])).toBe(true);
        expect(ajv.compile(target)([1, 'extra'])).toBe(false);
        expect(compatibleValues(port(source), port(target)).compatible).toBe(
            false,
        );
        expect(
            compatibleValues(port(source), port(tuple('string'))).compatible,
        ).toBe(true);
    });

    it('distinguishes schema dependencies from property-name dependencies', () => {
        const dependent = (body: string): JsonSchema => ({
            type: 'object',
            properties: { trigger: { type: 'boolean' }, body: {} },
            dependencies: { trigger: { $ref: '#/definitions/Rule' } },
            definitions: { Rule: { properties: { body: { type: body } } } },
        });
        const source = dependent('string');
        const target = dependent('integer');
        const ajv = new Ajv({ strict: false });
        expect(ajv.compile(source)({ trigger: true, body: 'payload' })).toBe(
            true,
        );
        expect(ajv.compile(target)({ trigger: true, body: 'payload' })).toBe(
            false,
        );
        expect(compatibleValues(port(source), port(target)).compatible).toBe(
            false,
        );
        const names: JsonSchema = {
            type: 'object',
            dependencies: { trigger: ['body'] },
        };
        expect(compatibleValues(port(names), port(names)).compatible).toBe(
            true,
        );
    });

    it('does not use an unresolved reference sibling to establish a scalar type', () => {
        const unresolved: JsonSchema = {
            $ref: '#/definitions/Missing',
            type: 'integer',
        };
        expect(
            compatibleValues(port(unresolved), port({ type: 'integer' }))
                .compatible,
        ).toBe(false);
    });
    it('resolves independent local definition names and ignores documentation annotations', () => {
        const source = module(
            1,
            {},
            {
                $ref: '#/definitions/ReturnValue',
                definitions: {
                    ReturnValue: {
                        ...(scalar as object),
                        description: 'result',
                    },
                },
            },
        );
        const target = module(
            2,
            { $ref: '#/definitions/InputValue', definitions: {} },
            scalar,
        );
        const argumentsSchema = target.api.arguments as Record<
            string,
            JsonValue
        >;
        argumentsSchema.definitions = {
            InputValue: {
                type: 'integer',
                minimum: 0,
                maximum: 100,
                title: 'input',
            },
        };
        expect(
            compatibleValues(
                modulePorts(source, 'returns')[0]!,
                modulePorts(target, 'arguments')[0]!,
            ).compatible,
        ).toBe(true);
    });

    it('does not mistake a matching primitive type for matching bounds or formats', () => {
        const loose = module(1, {}, { type: 'integer' });
        expect(
            compatibleValues(
                modulePorts(loose, 'returns')[0]!,
                modulePorts(consumer, 'arguments')[1]!,
            ).compatible,
        ).toBe(false);
        const strings = module(1, {}, { type: 'string' });
        const keyInput = module(
            2,
            {
                type: 'string',
                minLength: 64,
                maxLength: 64,
                pattern: '^[a-f0-9]+$',
            },
            {},
        );
        expect(
            compatibleValues(
                modulePorts(strings, 'returns')[0]!,
                modulePorts(keyInput, 'arguments')[0]!,
            ).compatible,
        ).toBe(false);
    });

    it('does not claim compatibility for recursive or unresolved schema references', () => {
        const recursive = module(
            1,
            {},
            {
                $ref: '#/definitions/Node',
                definitions: {
                    Node: {
                        type: 'object',
                        properties: { child: { $ref: '#/definitions/Node' } },
                    },
                },
            },
        );
        const port = modulePorts(recursive, 'returns')[0]!;
        expect(compatibleValues(port, port).compatible).toBe(false);
    });

    it('round-trips public graph/context data and rejects invalid or unsafe pointers', () => {
        const file = {
            ...patch(),
            context: { amount: 100, network: 'Regtest', lowering: 'Native' },
        };
        expect(parsePatch(JSON.stringify(file))).toEqual(file);
        expect(() =>
            parsePatch(JSON.stringify({ ...file, version: 99 })),
        ).toThrow(/version 1/);
        expect(() => readPointer({}, '/__proto__/polluted')).toThrow(
            /Reserved/,
        );
        expect(() => readPointer({}, '/bad~2pointer')).toThrow(/Invalid/);
        expect(readPointer({ 'a/b': { '~': 42 } }, '/a~1b/~0')).toBe(42);
    });
});
