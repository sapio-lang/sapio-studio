import Ajv from 'ajv';
import { describe, expect, it, vi } from 'vitest';
import type {
    JsonObject,
    JsonSchema,
    JsonValue,
    ModuleInfo,
} from '../../shared/studio';
import {
    checkConnection,
    parsePatch,
    runPatch,
    type Patch,
    type PatchRuntime,
    type ModuleNode,
    type VariableNode,
    type SubpatchNode,
    type PatchConnection,
    collectModuleKeys,
    connectionCompatibility,
    nodePorts,
    patchOutputs,
    resolveOutputType,
    putPointer,
    removePointer,
    validatePatch,
    withConnection,
} from './engine';
import {
    compatibleModule,
    sameSchema,
    compatibleValues,
    modulePorts,
    readPointer,
    initialValue,
    valuePorts,
    standaloneSchema,
    rebaseSchema,
    recordType,
    schemaLabel,
} from './schema';

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
function withOutput(
    graph: Patch,
    name: string,
    source: string,
    sourcePath = '',
): Patch {
    const id = `output-${name}`;
    graph.nodes.push({
        kind: 'output',
        id,
        name,
        position: { x: 900, y: 100 },
    });
    graph.connections.push({
        id: `${id}-wire`,
        kind: 'value',
        source,
        sourcePath,
        target: id,
        targetPath: '',
    });
    return graph;
}
const patch = (): Patch =>
    withOutput(
        {
            version: 2,

            nodes: [
                {
                    id: 'a',
                    kind: 'module',
                    moduleKey: producer.key,
                    arguments: {},
                    position: { x: 0, y: 0 },
                },
                {
                    id: 'b',
                    kind: 'module',
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
        },
        'result',
        'b',
        '',
    );

function runtime(
    catalog: ModuleInfo[],
    invoke: PatchRuntime['invoke'],
): PatchRuntime {
    const ajv = new Ajv({ strict: false });
    return {
        invoke,
        async validateValue(schema, value) {
            const validator = ajv.compile(schema);
            return {
                valid: validator(value),
                errors: (validator.errors ?? []).map(
                    (error) => error.message ?? '',
                ),
            };
        },
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
        (graph.nodes[0]! as ModuleNode).arguments = { nested: [unsafe] };
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
        expect((graph.nodes[1]! as ModuleNode).arguments).toEqual({});
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
                        'x-sapio-module': producer.api,
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
        (graph.nodes[0]! as ModuleNode).arguments =
            'not a valid provider invocation';
        (graph.nodes[1]! as ModuleNode).moduleKey = target.key;
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
                    (graph.nodes[1]! as ModuleNode).arguments = {
                        injected: true,
                    };
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

    it('marks refinements as checked at build instead of claiming equal constraints', () => {
        const loose = module(1, {}, { type: 'integer' });
        expect(
            compatibleValues(
                modulePorts(loose, 'returns')[0]!,
                modulePorts(consumer, 'arguments')[1]!,
            ).compatible,
        ).toBe(true);
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
        ).toBe(true);
    });

    it('matches productive recursive schemas but rejects unresolved references', () => {
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
        expect(compatibleValues(port, port).compatible).toBe(true);
        const unresolved = valuePorts({
            schema: { $ref: '#/definitions/Missing' },
        })[0]!;
        expect(compatibleValues(unresolved, unresolved).compatible).toBe(false);
    });

    it('round-trips public graph/context data and rejects invalid or unsafe pointers', () => {
        const file = {
            ...patch(),
            context: { amount: 100, network: 'Regtest', lowering: 'Native' },
        };
        expect(parsePatch(JSON.stringify(file))).toEqual(file);
        expect(() =>
            parsePatch(JSON.stringify({ ...file, version: 99 })),
        ).toThrow(/version 2/);
        expect(() => readPointer({}, '/__proto__/polluted')).toThrow(
            /Reserved/,
        );
        expect(() => readPointer({}, '/bad~2pointer')).toThrow(/Invalid/);
        expect(readPointer({ 'a/b': { '~': 42 } }, '/a~1b/~0')).toBe(42);
    });
});

const location = { x: 0, y: 0 };
const blocks: JsonSchema = {
    type: 'integer',
    'x-sapio-type': 'bitcoin.relative-blocks',
    title: 'Block delay',
    minimum: 1,
    maximum: 65535,
};
const satoshis: JsonSchema = {
    type: 'integer',
    'x-sapio-type': 'bitcoin.satoshis',
    title: 'Satoshis',
    minimum: 0,
};

function variablePatch(value: JsonValue | undefined = 144): Patch {
    return withOutput(
        {
            version: 2,
            nodes: [
                {
                    id: 'delay',
                    kind: 'variable',
                    name: 'Waiting period',
                    type: { schema: blocks },
                    value,
                    position: location,
                },
            ],
            connections: [],
        },
        'delay',
        'delay',
        '',
    );
}

describe('typed values and reusable patches', () => {
    it('evaluates a typed variable without loading or invoking a WASM module', async () => {
        const invoke = vi.fn();
        const result = await runPatch(
            variablePatch(),
            [],
            null,
            {},
            runtime([], invoke),
        );
        expect(result.output).toEqual({ delay: 144 });
        expect(result.values.get('delay')).toBe(144);
        expect(result.executed).toEqual([]);
        expect(invoke).not.toHaveBeenCalled();
    });

    it('keeps missing variables unset and rejects values outside their declared type', async () => {
        const missing = variablePatch();
        delete (missing.nodes[0] as VariableNode).value;
        await expect(
            runPatch(missing, [], null, {}, runtime([], vi.fn())),
        ).rejects.toThrow(/Waiting period is unset/);
        await expect(
            runPatch(variablePatch(0), [], null, {}, runtime([], vi.fn())),
        ).rejects.toThrow(/Invalid Waiting period/);
        await expect(
            runPatch(variablePatch('144'), [], null, {}, runtime([], vi.fn())),
        ).rejects.toThrow(/Invalid Waiting period/);
    });

    it('distinguishes semantic units even inside records and lists', () => {
        const port = (schema: JsonSchema) => valuePorts({ schema })[0]!;
        expect(compatibleValues(port(blocks), port(satoshis))).toMatchObject({
            compatible: false,
            status: 'incompatible',
        });
        expect(
            compatibleValues(port(blocks), port({ type: 'integer' }))
                .compatible,
        ).toBe(false);
        const record = (item: JsonSchema): JsonSchema => ({
            type: 'object',
            properties: { values: { type: 'array', items: item } },
            required: ['values'],
        });
        expect(
            compatibleValues(port(record(blocks)), port(record(satoshis)))
                .compatible,
        ).toBe(false);
        expect(
            compatibleValues(port(record(blocks)), port(record(blocks))).status,
        ).toBe('exact');
    });

    it('keeps a socket role separate from its semantic type name', () => {
        const api = module(
            4,
            {
                type: 'object',
                properties: {
                    trigger: {
                        type: 'object',
                        title: 'Trigger',
                        'x-sapio-type': 'sapio.authorization',
                    },
                },
            },
            {},
        );
        const port = modulePorts(api, 'arguments').find(
            (item) => item.path === '/trigger',
        )!;
        expect(port.label).toBe('Trigger');
        expect(schemaLabel(port)).toBe('Authorization');
    });

    it.each<JsonObject>([
        { $ref: '#/definitions/Parties' },
        { allOf: [{ $ref: '#/definitions/Parties' }] },
    ])('labels referenced module inputs by their payload type: %j', (ref) => {
        const api = module(4, { ...ref, title: 'Envelope field' }, {});
        const root = api.api.arguments as JsonObject;
        root.definitions = {
            Parties: { type: 'object', title: 'Signing parties' },
        };
        const port = modulePorts(api, 'arguments')[0]!;
        expect(port.label).toBe('Inputs');
        expect(schemaLabel(port)).toBe('Signing parties');

        root.definitions = { Parties: { type: 'object' } };
        expect(schemaLabel(modulePorts(api, 'arguments')[0]!)).toBe('Record');
        expect((root.properties as JsonObject).arguments).toEqual({
            ...ref,
            title: 'Envelope field',
        });
    });

    it('preserves a type title declared directly on the module payload', () => {
        const api = module(4, { type: 'object', title: 'Signing parties' }, {});
        expect(schemaLabel(modulePorts(api, 'arguments')[0]!)).toBe(
            'Signing parties',
        );
    });

    it('checks narrowed value constraints before invoking the destination', async () => {
        const limited = module(
            4,
            {
                type: 'object',
                properties: {
                    delay: { ...(blocks as JsonObject), maximum: 10 },
                },
                required: ['delay'],
            },
            blocks,
        );
        const graph = variablePatch(144);
        graph.nodes.push({
            id: 'consumer',
            kind: 'module',
            moduleKey: limited.key,
            arguments: {},
            position: location,
        });
        withOutput(graph, 'result', 'consumer');
        const edge: PatchConnection = {
            id: 'wire',
            kind: 'value',
            source: 'delay',
            sourcePath: '',
            target: 'consumer',
            targetPath: '/delay',
        };
        expect(connectionCompatibility(graph, [limited], edge).status).toBe(
            'checked-at-build',
        );
        graph.connections.push(edge);
        const invoke = vi.fn(async () => 1);
        await expect(
            runPatch(graph, [limited], null, {}, runtime([limited], invoke)),
        ).rejects.toThrow(/Invalid value for Block delay/);
        expect(invoke).not.toHaveBeenCalled();
    });

    it('extracts a local record into a shared variable without hidden fallback values', async () => {
        const api = module(
            4,
            {
                type: 'object',
                properties: {
                    schedule: {
                        type: 'object',
                        properties: {
                            delay: blocks,
                            fees: { type: 'array', items: satoshis },
                        },
                        required: ['delay', 'fees'],
                        additionalProperties: false,
                    },
                },
                required: ['schedule'],
            },
            blocks,
        );
        const original: Patch = withOutput(
            {
                version: 2,
                nodes: [
                    {
                        id: 'vault',
                        kind: 'module',
                        moduleKey: api.key,
                        arguments: {
                            schedule: { delay: 144, fees: [100, 200] },
                        },
                        position: location,
                    },
                ],
                connections: [],
            },
            'vault',
            'vault',
            '',
        );
        const invoke = vi.fn(async (_key, args) =>
            readPointer(args.arguments, '/schedule/delay'),
        );
        const before = await runPatch(
            original,
            [api],
            null,
            {},
            runtime([api], invoke),
        );
        const extracted = structuredClone(original);
        const socket = modulePorts(api, 'arguments').find(
            (item) => item.path === '/schedule',
        )!;
        extracted.nodes.push({
            id: 'schedule',
            kind: 'variable',
            name: 'Shared schedule',
            type: { schema: socket.schema, root: socket.root },
            value: readPointer(
                (original.nodes[0] as ModuleNode).arguments!,
                '/schedule',
            ),
            position: location,
        });
        const wired = withConnection(extracted, [api], {
            id: 'wire',
            kind: 'value',
            source: 'schedule',
            sourcePath: '',
            target: 'vault',
            targetPath: '/schedule',
        });
        expect((wired.nodes[0] as ModuleNode).arguments).toEqual({});
        expect((original.nodes[0] as ModuleNode).arguments).toEqual({
            schedule: { delay: 144, fees: [100, 200] },
        });
        expect(
            (await runPatch(wired, [api], null, {}, runtime([api], invoke)))
                .output,
        ).toEqual(before.output);
        wired.connections = wired.connections.filter(
            (edge) => edge.id !== 'wire',
        );
        await expect(
            runPatch(wired, [api], null, {}, runtime([api], invoke)),
        ).rejects.toThrow(/Invalid arguments/);
        const conflicting = structuredClone(extracted);
        conflicting.connections = [
            {
                id: 'wire',
                kind: 'value',
                source: 'schedule',
                sourcePath: '',
                target: 'vault',
                targetPath: '/schedule',
            },
        ];
        expect(() => validatePatch(conflicting, [api])).toThrow(/one source/);
    });

    it('seeds explicit defaults without choosing keys, enum alternatives, or amounts', () => {
        const schema: JsonSchema = {
            type: 'object',
            properties: {
                fee: { ...(satoshis as JsonObject) },
                delay: { ...(blocks as JsonObject), default: 144 },
                mode: { enum: ['hot', 'cold'] },
                address: { type: 'string' },
                settings: {
                    type: 'object',
                    properties: { rate: { type: 'number' } },
                },
                enabled: { type: 'boolean', const: true },
            },
            required: ['fee', 'delay', 'mode', 'address', 'settings'],
        };
        expect(initialValue({ schema })).toEqual({ delay: 144, enabled: true });
        expect(
            initialValue({ schema: { enum: ['hot', 'cold'] } }),
        ).toBeUndefined();
        expect(initialValue({ schema: satoshis })).toBeUndefined();
    });

    it('executes reusable named parameters and outputs with inherited context', async () => {
        const api = module(
            4,
            {
                type: 'object',
                properties: { delay: blocks },
                required: ['delay'],
            },
            blocks,
        );
        const definition: Patch = withOutput(
            withOutput(
                {
                    version: 2,
                    nodes: [
                        {
                            id: 'parameter',
                            kind: 'parameter',
                            name: 'waiting period',
                            type: { schema: blocks },
                            default: 144,
                            position: location,
                        },
                        {
                            id: 'build',
                            kind: 'module',
                            moduleKey: api.key,
                            arguments: {},
                            position: location,
                        },
                    ],
                    connections: [
                        {
                            id: 'wire',
                            kind: 'value',
                            source: 'parameter',
                            sourcePath: '',
                            target: 'build',
                            targetPath: '/delay',
                        },
                    ],
                },
                'vault',
                'build',
                '',
            ),
            'delay',
            'parameter',
            '',
        );
        const graph: Patch = withOutput(
            {
                version: 2,
                nodes: [
                    {
                        id: 'sub',
                        kind: 'subpatch',
                        name: 'Custody program',
                        patch: definition,
                        arguments: { 'waiting period': 288 },
                        position: location,
                    },
                ],
                connections: [],
            },
            'result',
            'sub',
            '/vault',
        );
        const invoke = vi.fn(async (_key, input) => {
            expect(input.context).toEqual({ amount: 100000 });
            return readPointer(input.arguments, '/delay');
        });
        const result = await runPatch(
            graph,
            [api],
            null,
            { amount: 100000 },
            runtime([api], invoke),
        );
        expect(result.output).toEqual({ result: 288 });
        expect(result.executed).toEqual(['sub/build']);
        expect(result.values.get('sub')).toEqual({ delay: 288, vault: 288 });
        expect(collectModuleKeys(graph)).toEqual([api.key]);
        expect(
            nodePorts(graph.nodes[0]!, [api], 'arguments').find(
                (item) => item.path === '/waiting period',
            )?.required,
        ).toBe(false);
        (graph.nodes[0] as SubpatchNode).arguments = {};
        expect(
            (
                await runPatch(
                    graph,
                    [api],
                    null,
                    { amount: 100000 },
                    runtime([api], invoke),
                )
            ).output,
        ).toEqual({ result: 144 });
        (graph.nodes[0] as SubpatchNode).arguments = { unknown: 1 };
        await expect(
            runPatch(graph, [api], null, {}, runtime([api], invoke)),
        ).rejects.toThrow(/Invalid inputs/);
    });

    it('keeps output values and invocation order independent of node order, edges, names, and layout', async () => {
        const api = module(
            4,
            {
                type: 'object',
                properties: { a: scalar, b: scalar },
                required: ['a', 'b'],
            },
            scalar,
        );
        const graph: Patch = withOutput(
            {
                version: 2,
                nodes: [
                    {
                        id: 'a',
                        kind: 'module',
                        moduleKey: producer.key,
                        arguments: {},
                        position: location,
                    },
                    {
                        id: 'b',
                        kind: 'module',
                        moduleKey: producer.key,
                        arguments: {},
                        position: location,
                    },
                    {
                        id: 'sum',
                        kind: 'module',
                        moduleKey: api.key,
                        arguments: {},
                        position: location,
                    },
                ],
                connections: ['a', 'b'].map((name) => ({
                    id: name,
                    kind: 'value',
                    source: name,
                    sourcePath: '',
                    target: 'sum',
                    targetPath: `/${name}`,
                })),
            },
            'result',
            'sum',
            '',
        );
        const invoke = vi.fn(async (key, args) =>
            key === producer.key
                ? 20
                : Number(readPointer(args.arguments, '/a')) +
                  Number(readPointer(args.arguments, '/b')),
        );
        const first = await runPatch(
            graph,
            [producer, api],
            null,
            {},
            runtime([producer, api], invoke),
        );
        graph.nodes.reverse();
        graph.connections.reverse();
        graph.nodes.forEach((node) => {
            node.position = { x: 123, y: 999 };
            node.label = 'A presentation-only label';
        });
        const second = await runPatch(
            graph,
            [producer, api],
            null,
            {},
            runtime([producer, api], invoke),
        );
        expect(first.output).toEqual(second.output);
        expect(first.executed).toEqual(second.executed);
    });

    it('snapshots variables, embedded graphs, API schemas, and progress values during execution', async () => {
        const graph = patch();
        graph.nodes.push({
            id: 'input',
            kind: 'variable',
            name: 'Amount',
            type: { schema: scalar },
            value: 4,
            position: location,
        });
        graph.connections = graph.connections.map((edge) =>
            edge.target === 'b' ? { ...edge, source: 'input' } : edge,
        );
        const catalog = structuredClone(modules);
        const rt = runtime(
            catalog,
            vi.fn(async (_key, args) => readPointer(args.arguments, '/amount')),
        );
        const validateValue = rt.validateValue;
        rt.validateValue = async (schema, value) => {
            (
                graph.nodes.find((node) => node.id === 'input') as VariableNode
            ).value = 999;
            (catalog[1]!.api.arguments as JsonObject).properties = {};
            return validateValue(schema, value);
        };
        // Runtime validation uses an independent catalog, as the desktop does.
        rt.validate = runtime(modules, vi.fn()).validate;
        const result = await runPatch(graph, catalog, null, {}, rt, (event) => {
            if (event.value && typeof event.value === 'object')
                (event.value as JsonObject).changed = true;
        });
        expect(result.output).toEqual({ result: 4 });
        expect(result.values.get('input')).toBe(4);
    });

    it('requires wired Outputs when building all and allows intermediate evaluation', async () => {
        const graph = variablePatch();
        graph.connections = [];
        await expect(
            runPatch(graph, [], null, {}, runtime([], vi.fn())),
        ).rejects.toThrow(/Connect a value to Output/);
        expect(
            (await runPatch(graph, [], 'delay', {}, runtime([], vi.fn())))
                .output,
        ).toBe(144);
        const saved = { ...graph, context: {} };
        expect(parsePatch(JSON.stringify(saved))).toEqual(saved);
    });

    it('infers terminal types from one declared value wire and never exposes an outbound port', () => {
        const graph = variablePatch();
        const terminal = patchOutputs(graph)[0]!;
        expect(
            sameSchema(resolveOutputType(graph, terminal, [])!, {
                schema: blocks,
            }),
        ).toBe(true);
        expect(nodePorts(terminal, [], 'returns', graph)).toEqual([]);
        expect(
            checkConnection(graph, [], {
                id: 'second-source',
                kind: 'value',
                source: 'delay',
                sourcePath: '',
                target: terminal.id,
                targetPath: '',
            }),
        ).toMatch(/already|source|overlap/i);
        expect(
            checkConnection(graph, [], {
                id: 'wrong-path',
                kind: 'value',
                source: 'delay',
                sourcePath: '',
                target: terminal.id,
                targetPath: '/field',
            }),
        ).toMatch(/one input/);
        const implementation = module(1, {}, blocks);
        graph.nodes.push({
            id: 'implementation',
            kind: 'module',
            moduleKey: implementation.key,
            arguments: {},
            position: location,
        });
        expect(
            checkConnection(graph, [implementation], {
                id: 'raw-reference',
                kind: 'module',
                source: 'implementation',
                sourcePath: '',
                target: terminal.id,
                targetPath: '',
            }),
        ).toMatch(/declared result/);
        graph.nodes.push({
            kind: 'output',
            id: 'other-output',
            name: 'other',
            position: location,
        });
        expect(
            checkConnection(graph, [implementation], {
                id: 'outbound',
                kind: 'value',
                source: terminal.id,
                sourcePath: '',
                target: 'other-output',
                targetPath: '',
            }),
        ).toMatch(/not a declared value output/);
        graph.nodes.push({
            kind: 'variable',
            id: 'fees',
            name: 'Fees',
            type: { schema: satoshis },
            value: 144,
            position: location,
        });
        graph.connections = graph.connections.map((edge) =>
            edge.target === terminal.id ? { ...edge, source: 'fees' } : edge,
        );
        expect(
            sameSchema(resolveOutputType(graph, terminal, [implementation])!, {
                schema: satoshis,
            }),
        ).toBe(true);
    });

    it('builds a chosen terminal independently and rejects duplicate interface names', async () => {
        const graph = variablePatch();
        graph.nodes.push({
            kind: 'output',
            id: 'unfinished',
            name: 'unfinished',
            position: location,
        });
        expect(
            (
                await runPatch(
                    graph,
                    [],
                    'output-delay',
                    {},
                    runtime([], vi.fn()),
                )
            ).output,
        ).toBe(144);
        await expect(
            runPatch(graph, [], null, {}, runtime([], vi.fn())),
        ).rejects.toThrow(/Output unfinished/);
        graph.nodes.push({
            kind: 'output',
            id: 'duplicate',
            name: 'delay',
            position: location,
        });
        expect(() => validatePatch(graph, [])).toThrow(
            /Output names must be unique/,
        );
        expect(() =>
            parsePatch(
                JSON.stringify({
                    ...variablePatch(),
                    outputs: [],
                    output: null,
                    context: {},
                }),
            ),
        ).toThrow(/wired Output nodes/);
        const dangling = variablePatch();
        dangling.connections[0]!.source = 'missing';
        expect(() =>
            parsePatch(JSON.stringify({ ...dangling, context: {} })),
        ).toThrow(/unknown node/);
        const outbound = variablePatch();
        outbound.connections[0]!.source = 'output-delay';
        expect(() =>
            parsePatch(JSON.stringify({ ...outbound, context: {} })),
        ).toThrow(/outgoing connections/);
    });

    it('scopes contexts before validation and records detached invocation provenance', async () => {
        const api = module(
            6,
            { type: 'object' },
            {
                type: 'object',
                properties: { marker: { type: 'integer' } },
                required: ['marker'],
            },
        );
        const graph = withOutput(
            withOutput(
                {
                    version: 2,
                    nodes: ['left', 'right'].map((id) => ({
                        id,
                        kind: 'module' as const,
                        moduleKey: api.key,
                        arguments: {},
                        position: location,
                    })),
                    connections: [],
                },
                'left',
                'left',
            ),
            'right',
            'right',
        );
        const context = { marker: 2 };
        const invoke = vi.fn(async (_key, args) => ({
            marker: readPointer(args.context, '/marker'),
        }));
        const defaults: JsonValue[] = [];
        const result = await runPatch(graph, [api], null, context, {
            ...runtime([api], invoke),
            contextForNode(path, inherited) {
                defaults.push(structuredClone(inherited));
                const marker = path[0] === 'left' ? 3 : 4;
                path.push('not part of the graph');
                (inherited as JsonObject).marker = marker;
                return inherited;
            },
        });
        expect(context).toEqual({ marker: 2 });
        expect(defaults).toEqual([{ marker: 2 }, { marker: 2 }]);
        expect(result.output).toEqual({
            left: { marker: 3 },
            right: { marker: 4 },
        });
        expect(result.trace).toEqual(
            ['left', 'right'].map((id, index) => ({
                nodePath: [id],
                moduleKey: api.key,
                args: { arguments: {}, context: { marker: index + 3 } },
                result: { marker: index + 3 },
            })),
        );
        (result.trace[0]!.result as JsonObject).marker = 99;
        expect(result.values.get('left')).toEqual({ marker: 3 });
        const invalidInvoke = vi.fn();
        await expect(
            runPatch(graph, [api], 'output-left', context, {
                ...runtime([api], invalidInvoke),
                contextForNode: () => 'invalid context',
            }),
        ).rejects.toThrow(/Invalid arguments/);
        expect(invalidInvoke).not.toHaveBeenCalled();
    });

    it('round-trips typed standalone fields with their local references intact', async () => {
        const root: JsonSchema = {
            type: 'object',
            properties: { schedule: { $ref: '#/definitions/Schedule' } },
            definitions: {
                Schedule: {
                    type: 'object',
                    properties: {
                        delays: {
                            type: 'array',
                            items: { $ref: '#/definitions/Blocks' },
                        },
                    },
                    required: ['delays'],
                },
                Blocks: blocks,
            },
        };
        const selected = { schema: { $ref: '#/definitions/Schedule' }, root };
        const schema = standaloneSchema(selected);
        const validate = new Ajv({ strict: false }).compile(schema);
        expect(validate({ delays: [144, 288] })).toBe(true);
        expect(validate({ delays: [0] })).toBe(false);
        expect(schemaLabel(valuePorts(selected)[1]!)).toBe('List of Blocks');
        const sub = variablePatch();
        sub.nodes[0] = { ...(sub.nodes[0] as VariableNode), type: selected };
        (sub.nodes[0] as VariableNode).value = { delays: [144] };
        const graph: Patch = withOutput(
            {
                version: 2,
                nodes: [
                    {
                        id: 'nested',
                        kind: 'subpatch',
                        name: 'Schedule',
                        patch: sub,
                        arguments: {},
                        position: location,
                    },
                ],
                connections: [],
            },
            'out',
            'nested',
            '/delay/delays',
        );
        expect(
            (await runPatch(graph, [], null, {}, runtime([], vi.fn()))).output,
        ).toEqual({ out: [144] });
    });

    it('rejects unsafe numbers in nested patches and keeps arrays dense', () => {
        const graph = variablePatch();
        (graph.nodes[0] as VariableNode).value = 2 ** 53;
        expect(() =>
            parsePatch(JSON.stringify({ ...graph, context: {} })),
        ).toThrow(/exact integer range/);
        expect(putPointer({ fees: [1] }, '/fees/1', 2)).toEqual({
            fees: [1, 2],
        });
        expect(() => putPointer({ fees: [1] }, '/fees/2', 3)).toThrow(
            /missing elements/,
        );
        expect(removePointer({ a: 1, b: 2 }, '/a')).toEqual({ b: 2 });
    });
});

describe('callable interface boundaries', () => {
    const socket = (api: ModuleInfo['api']): JsonSchema => ({
        type: 'object',
        properties: {
            which_plugin: {
                type: 'object',
                properties: { HashKey: { type: 'string' } },
                required: ['HashKey'],
                additionalProperties: false,
            },
        },
        required: ['which_plugin'],
        additionalProperties: false,
        'x-sapio-module': api,
    });

    it('requires explicit callable metadata and checks both arguments and results', () => {
        const provider = module(1, blocks, satoshis);
        const accepts = module(
            2,
            {
                type: 'object',
                properties: { policy: socket(provider.api) },
                required: ['policy'],
            },
            satoshis,
        );
        const graph: Patch = {
            version: 2,
            nodes: [
                {
                    id: 'provider',
                    kind: 'module',
                    moduleKey: provider.key,
                    position: location,
                },
                {
                    id: 'consumer',
                    kind: 'module',
                    moduleKey: accepts.key,
                    arguments: {},
                    position: location,
                },
            ],
            connections: [],
        };
        const edge: PatchConnection = {
            id: 'ref',
            kind: 'module',
            source: 'provider',
            sourcePath: '',
            target: 'consumer',
            targetPath: '/policy',
        };
        expect(checkConnection(graph, [provider, accepts], edge)).toBeNull();
        expect(
            checkConnection(graph, [provider, accepts], {
                ...edge,
                kind: 'value',
            }),
        ).toMatch(/different sockets/);
        const wrong = structuredClone(provider);
        wrong.api.returns = blocks;
        expect(checkConnection(graph, [wrong, accepts], edge)).toMatch(
            /does not implement/,
        );
        const wrongContext = structuredClone(provider);
        (
            (wrongContext.api.arguments as JsonObject).properties as JsonObject
        ).context = { type: 'string' };
        expect(checkConnection(graph, [wrongContext, accepts], edge)).toMatch(
            /does not implement/,
        );
        const legacyShape = socket(provider.api) as JsonObject;
        delete legacyShape['x-sapio-module'];
        expect(valuePorts({ schema: legacyShape })[0]!.kind).toBe('value');
    });

    it('compares recursive callable result APIs after renaming local definitions', () => {
        const left: JsonSchema = {
            $ref: '#/definitions/A',
            definitions: {
                A: {
                    type: 'object',
                    properties: {
                        next: { $ref: '#/definitions/A' },
                        key: blocks,
                    },
                },
            },
        };
        const right = JSON.parse(
            JSON.stringify(left)
                .replaceAll('definitions/A', 'definitions/B')
                .replace('"A":', '"B":'),
        ) as JsonSchema;
        const provider = module(1, {}, left);
        const expected = module(2, {}, right);
        const input = valuePorts({
            schema: socket({
                ...expected.api,
                returns: rebaseSchema(
                    expected.api.returns,
                    '#/x-sapio-module/returns',
                ),
            }),
        })[0]!;
        expect(compatibleModule(provider, input).compatible).toBe(true);
        const changed = structuredClone(right) as JsonObject;
        (
            ((changed.definitions as JsonObject).B as JsonObject)
                .properties as JsonObject
        ).key = satoshis;
        expect(
            compatibleModule(
                { ...provider, api: { ...provider.api, returns: changed } },
                input,
            ).compatible,
        ).toBe(false);
    });

    const recursiveCallable = (
        name: string,
        quantity: JsonSchema = blocks,
    ): JsonSchema => ({
        $ref: `#/definitions/${name}Arguments`,
        definitions: {
            [`${name}Arguments`]: module(
                1,
                {
                    type: 'object',
                    properties: {
                        next: { $ref: `#/definitions/${name}Handle` },
                        quantity: { $ref: `#/definitions/${name}Quantity` },
                    },
                    required: ['next', 'quantity'],
                    additionalProperties: false,
                },
                satoshis,
            ).api.arguments,
            [`${name}Handle`]: socket({
                arguments: { $ref: `#/definitions/${name}Arguments` },
                returns: { $ref: `#/definitions/${name}Result` },
            }),
            [`${name}Quantity`]: quantity,
            [`${name}Result`]: satoshis,
        },
    });

    it('matches recursive callable metadata in the containing schema graph', () => {
        const implementation = {
            ...module(1, {}, satoshis),
            api: {
                arguments: recursiveCallable('Provider'),
                returns: satoshis,
            },
        };
        const target = valuePorts({
            schema: { $ref: '#/definitions/ConsumerHandle' },
            root: recursiveCallable('Consumer'),
        })[0]!;
        expect(compatibleModule(implementation, target).compatible).toBe(true);
        expect(
            sameSchema(
                { schema: recursiveCallable('Provider') },
                { schema: recursiveCallable('Consumer') },
            ),
        ).toBe(true);
        expect(
            compatibleModule(
                {
                    ...implementation,
                    api: {
                        ...implementation.api,
                        arguments: recursiveCallable('Wrong', satoshis),
                    },
                },
                target,
            ).compatible,
        ).toBe(false);
        const broken = structuredClone(target);
        broken.schema = socket({
            arguments: { $ref: '#/definitions/Missing' },
            returns: satoshis,
        });
        expect(compatibleModule(implementation, broken).compatible).toBe(false);
    });

    it('preserves recursive callable roots through extraction and reusable inputs', async () => {
        const root = recursiveCallable('Original');
        const selected = {
            schema: { $ref: '#/definitions/OriginalHandle' },
            root,
        };
        const implementation = {
            ...module(1, {}, satoshis),
            api: { arguments: root, returns: satoshis },
        };
        const extracted = { schema: standaloneSchema(selected) };
        const originalPort = valuePorts(selected)[0]!;
        const extractedPort = valuePorts(extracted)[0]!;
        expect(compatibleModule(implementation, extractedPort).compatible).toBe(
            true,
        );
        expect(compatibleValues(originalPort, extractedPort).status).toBe(
            'exact',
        );
        const record = recordType([
            { name: 'policy', type: extracted, required: true },
            {
                name: 'other',
                type: {
                    schema: { $ref: '#/definitions/OriginalHandle' },
                    root: recursiveCallable('Original', satoshis),
                },
                required: true,
            },
        ]);
        const ports = valuePorts(record, 'arguments');
        expect(
            compatibleModule(
                implementation,
                ports.find((port) => port.path === '/policy')!,
            ).compatible,
        ).toBe(true);
        expect(
            compatibleModule(
                implementation,
                ports.find((port) => port.path === '/other')!,
            ).compatible,
        ).toBe(false);
        const reference = { which_plugin: { HashKey: implementation.key } };
        const definition: Patch = withOutput(
            {
                version: 2,
                nodes: [
                    {
                        id: 'policy',
                        kind: 'parameter',
                        name: 'policy',
                        type: extracted,
                        position: location,
                    },
                ],
                connections: [],
            },
            'policy',
            'policy',
            '',
        );
        const graph: Patch = withOutput(
            {
                version: 2,
                nodes: [
                    {
                        id: 'nested',
                        kind: 'subpatch',
                        name: 'Recursive policy',
                        patch: definition,
                        arguments: { policy: reference },
                        position: location,
                    },
                ],
                connections: [],
            },
            'policy',
            'nested',
            '/policy',
        );
        const invoke = vi.fn();
        const result = await runPatch(
            graph,
            [implementation],
            null,
            {},
            runtime([implementation], invoke),
        );
        expect(result.output).toEqual({ policy: reference });
        expect(invoke).not.toHaveBeenCalled();
        const wrong = {
            ...implementation,
            api: {
                ...implementation.api,
                arguments: recursiveCallable('Wrong', satoshis),
            },
        };
        await expect(
            runPatch(graph, [wrong], null, {}, runtime([wrong], invoke)),
        ).rejects.toThrow(/does not implement/);
    });

    it('evaluates callable reference values and checks the selected implementation before use', async () => {
        const provider = module(1, blocks, satoshis);
        const reference = socket(provider.api);
        const selector = module(3, { type: 'object' }, reference);
        const wrong = module(4, blocks, blocks);
        const accepts = module(
            2,
            {
                type: 'object',
                properties: { policy: reference },
                required: ['policy'],
            },
            satoshis,
        );
        const catalog = [provider, selector, accepts, wrong];
        const graph: Patch = withOutput(
            {
                version: 2,
                nodes: [
                    {
                        kind: 'module',
                        id: 'selector',
                        moduleKey: selector.key,
                        arguments: {},
                        position: location,
                    },
                    {
                        kind: 'module',
                        id: 'consumer',
                        moduleKey: accepts.key,
                        arguments: {},
                        position: location,
                    },
                ],
                connections: [
                    {
                        id: 'reference-value',
                        kind: 'value',
                        source: 'selector',
                        sourcePath: '',
                        target: 'consumer',
                        targetPath: '/policy',
                    },
                ],
            },
            'result',
            'consumer',
            '',
        );
        expect(
            checkConnection(graph, catalog, graph.connections[0]!),
        ).toBeNull();
        for (const selected of [provider.key, wrong.key]) {
            const invoke = vi.fn(
                async (
                    key: string,
                    args: { arguments: JsonValue; context: JsonValue },
                ): Promise<JsonValue> => {
                    if (key === selector.key)
                        return { which_plugin: { HashKey: selected } };
                    expect(args.arguments).toEqual({
                        policy: { which_plugin: { HashKey: selected } },
                    });
                    return 7;
                },
            );
            if (selected === provider.key) {
                const result = await runPatch(
                    graph,
                    catalog,
                    null,
                    {},
                    runtime(catalog, invoke),
                );
                expect(result.output).toEqual({ result: 7 });
                expect(result.executed).toEqual(['selector', 'consumer']);
                expect(invoke.mock.calls.map(([key]) => key)).toEqual([
                    selector.key,
                    accepts.key,
                ]);
            } else {
                await expect(
                    runPatch(
                        graph,
                        catalog,
                        null,
                        {},
                        runtime(catalog, invoke),
                    ),
                ).rejects.toThrow(/does not implement/);
                expect(invoke.mock.calls.map(([key]) => key)).toEqual([
                    selector.key,
                ]);
            }
        }
        graph.nodes[0] = {
            kind: 'variable',
            id: 'selector',
            name: 'Selected policy',
            type: { schema: reference },
            value: { which_plugin: { HashKey: provider.key } },
            position: location,
        };
        expect(
            checkConnection(graph, catalog, graph.connections[0]!),
        ).toBeNull();
        expect(
            checkConnection(graph, catalog, {
                ...graph.connections[0]!,
                kind: 'module',
            }),
        ).toMatch(/Only a module node/);
        const invoke = vi.fn(async () => 7);
        const result = await runPatch(
            graph,
            catalog,
            null,
            {},
            runtime(catalog, invoke),
        );
        expect(result.executed).toEqual(['consumer']);
        expect(result.output).toEqual({ result: 7 });
    });

    it('retains semantic markers beside references and preserves data-valued annotations', () => {
        const port = (schema: JsonSchema) => valuePorts({ schema })[0]!;
        const root: JsonSchema = {
            $ref: '#/definitions/Value',
            'x-sapio-type': 'bitcoin.relative-blocks',
            definitions: { Value: { type: 'integer' } },
        };
        expect(sameSchema({ schema: root }, { schema: blocks })).toBe(false);
        expect(compatibleValues(port(root), port(satoshis)).compatible).toBe(
            false,
        );
        const branded = (identity: string): JsonSchema => ({
            $ref: '#/definitions/Value',
            'x-sapio-type': identity,
            definitions: { Value: true },
        });
        expect(
            compatibleValues(
                port(branded('example.a')),
                port(branded('example.b')),
            ).compatible,
        ).toBe(false);
        const literal: JsonSchema = { const: { minimum: 1, $ref: '#/a' } };
        expect(
            sameSchema(
                { schema: literal },
                { schema: { const: { minimum: 2, $ref: '#/a' } } },
            ),
        ).toBe(false);
        expect(
            compatibleValues(
                port(literal),
                port({ const: { minimum: 2, $ref: '#/a' } }),
            ).compatible,
        ).toBe(false);
        const field = standaloneSchema({
            schema: literal,
            root: { definitions: { Unused: { type: 'string' } } },
        });
        expect((field as JsonObject).const).toEqual({
            minimum: 1,
            $ref: '#/a',
        });
        const unordered: JsonSchema = { type: 'object', required: ['a', 'b'] };
        expect(
            sameSchema(
                { schema: unordered },
                { schema: { type: 'object', required: ['b', 'a'] } },
            ),
        ).toBe(true);
        expect(
            sameSchema(
                { schema: { type: 'string', readOnly: true } },
                { schema: { type: 'string' } },
            ),
        ).toBe(false);
    });

    it('treats later-draft keywords as literal data in exact Draft 7 signatures', () => {
        for (const keyword of ['dependentSchemas', 'prefixItems']) {
            const field = (title: string) => ({ type: 'string', title });
            const left: JsonSchema = {
                type: 'object',
                [keyword]:
                    keyword === 'prefixItems'
                        ? [field('First')]
                        : { value: field('First') },
            };
            const right: JsonSchema = {
                type: 'object',
                [keyword]:
                    keyword === 'prefixItems'
                        ? [field('Second')]
                        : { value: field('Second') },
            };
            expect(sameSchema({ schema: left }, { schema: left })).toBe(true);
            expect(sameSchema({ schema: left }, { schema: right })).toBe(false);
        }
    });
});
