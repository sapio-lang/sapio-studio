import type {
    JsonObject,
    JsonSchema,
    JsonValue,
    ModuleInfo,
} from '../../shared/studio';
import {
    compatibleModule,
    compatibleValues,
    escapePointer,
    modulePorts,
    object,
    pointerTokens,
    readPointer,
    recordType,
    standaloneSchema,
    valuePorts,
    type Compatibility,
    type SchemaPort,
    type ValueType,
} from './schema';

interface NodeBase {
    id: string;
    label?: string;
    position: { x: number; y: number };
}
export interface ModuleNode extends NodeBase {
    kind: 'module';
    moduleKey: string;
    arguments?: JsonValue;
}
export interface VariableNode extends NodeBase {
    kind: 'variable';
    name: string;
    readonly type: ValueType;
    value?: JsonValue;
}
export interface ParameterNode extends NodeBase {
    kind: 'parameter';
    name: string;
    readonly type: ValueType;
    default?: JsonValue;
}
export interface SubpatchNode extends NodeBase {
    kind: 'subpatch';
    name: string;
    patch: Patch;
    arguments?: JsonValue;
}
export interface OutputNode extends NodeBase {
    kind: 'output';
    name: string;
}
export type PatchNode =
    ModuleNode | VariableNode | ParameterNode | SubpatchNode | OutputNode;
export interface PatchConnection {
    id: string;
    kind: 'value' | 'module';
    source: string;
    sourcePath: string;
    target: string;
    targetPath: string;
}
export interface Patch {
    version: 2;
    nodes: PatchNode[];
    connections: PatchConnection[];
}
export interface PatchFile extends Patch {
    context: JsonValue;
}
export interface PatchRuntime {
    contextForNode?(nodePath: string[], defaultContext: JsonValue): JsonValue;
    invoke(
        key: string,
        args: { arguments: JsonValue; context: JsonValue },
    ): Promise<JsonValue>;
    validate(
        key: string,
        side: 'arguments' | 'returns',
        value: JsonValue,
    ): Promise<{ valid: boolean; errors: string[] }>;
    validateValue(
        schema: JsonSchema,
        value: JsonValue,
    ): Promise<{ valid: boolean; errors: string[] }>;
}
export interface PatchProgress {
    node: string;
    state: 'running' | 'complete';
    value?: JsonValue;
}
export interface PatchResult {
    output: JsonValue;
    values: Map<string, JsonValue>;
    executed: string[];
    trace: PatchInvocation[];
}
export interface PatchInvocation {
    nodePath: string[];
    moduleKey: string;
    args: JsonValue;
    result: JsonValue;
}

/** JSON numbers must survive a renderer round trip without integer rounding. */
export function assertJsonNumbers(value: JsonValue, label: string): void {
    const pending = [value];
    while (pending.length) {
        const next = pending.pop();
        if (typeof next === 'number') {
            if (
                !Number.isFinite(next) ||
                (Number.isInteger(next) && !Number.isSafeInteger(next))
            )
                throw new Error(
                    `${label} contains a number outside JavaScript's exact integer range. Use a module API with a string representation for larger integers.`,
                );
        } else if (Array.isArray(next)) {
            for (const item of next) pending.push(item);
        } else if (object(next)) {
            for (const item of Object.values(next)) pending.push(item);
        }
    }
}

function compareText(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export function ancestorPath(a: string, b: string): boolean {
    return a === b || a === '' || b.startsWith(`${a}/`);
}

export function collectModuleKeys(patch: Patch): string[] {
    const keys = new Set<string>();
    const walk = (graph: Patch, depth: number) => {
        if (depth > 8)
            throw new Error('Subpatches may be nested at most eight levels.');
        for (const node of graph.nodes) {
            if (node.kind === 'module') keys.add(node.moduleKey);
            else if (node.kind === 'subpatch') walk(node.patch, depth + 1);
        }
    };
    walk(patch, 0);
    return [...keys].sort();
}

export function patchOutputs(patch: Patch): OutputNode[] {
    return patch.nodes.filter(
        (node): node is OutputNode => node.kind === 'output',
    );
}

export function resolveOutputType(
    patch: Patch,
    output: OutputNode,
    modules: ModuleInfo[],
    depth = 0,
): ValueType | undefined {
    const wires = patch.connections.filter((edge) => edge.target === output.id);
    if (
        wires.length !== 1 ||
        wires[0]!.kind !== 'value' ||
        wires[0]!.targetPath !== ''
    )
        return undefined;
    const wire = wires[0]!;
    const node = patch.nodes.find((item) => item.id === wire.source);
    const port =
        node &&
        nodePorts(node, modules, 'returns', patch, depth).find(
            (item) => item.path === wire.sourcePath,
        );
    return port && { schema: port.schema, root: port.root };
}

export function nodePorts(
    node: PatchNode,
    modules: ModuleInfo[],
    side: 'arguments' | 'returns',
    patch?: Patch,
    depth = 0,
): SchemaPort[] {
    if (depth > 8) return [];
    if (node.kind === 'module') {
        const module = modules.find((item) => item.key === node.moduleKey);
        return module ? modulePorts(module, side) : [];
    }
    if (node.kind === 'variable' || node.kind === 'parameter')
        return side === 'returns' ? valuePorts(node.type) : [];
    if (node.kind === 'output') {
        if (side === 'returns') return [];
        const type = patch && resolveOutputType(patch, node, modules, depth);
        const port = type && valuePorts(type, 'arguments')[0];
        return [
            {
                ...(port ?? {
                    schema: true,
                    root: true,
                    kind: 'value' as const,
                }),
                path: '',
                label: 'Value',
                required: true,
            },
        ];
    }
    const fields: { name: string; type: ValueType; required: boolean }[] = [];
    if (side === 'arguments') {
        for (const parameter of node.patch.nodes) {
            if (parameter.kind === 'parameter')
                fields.push({
                    name: parameter.name,
                    type: parameter.type,
                    required: parameter.default === undefined,
                });
        }
    } else {
        for (const output of patchOutputs(node.patch)) {
            const type = resolveOutputType(
                node.patch,
                output,
                modules,
                depth + 1,
            );
            if (type) fields.push({ name: output.name, type, required: true });
        }
    }
    return valuePorts(recordType(fields), side);
}

export function connectionCompatibility(
    patch: Patch,
    modules: ModuleInfo[],
    edge: PatchConnection,
): Compatibility {
    const fail = (reason: string): Compatibility => ({
        compatible: false,
        status: 'incompatible',
        reason,
    });
    const source = patch.nodes.find((node) => node.id === edge.source);
    const target = patch.nodes.find((node) => node.id === edge.target);
    if (!source || !target) return fail('Both nodes must exist in the patch.');
    if (target.kind === 'output') {
        if (edge.targetPath !== '')
            return fail('An Output has one input, for its complete value.');
        if (edge.kind !== 'value')
            return fail(
                'Wire a declared result into an Output, not a callable implementation hash.',
            );
        const port = nodePorts(source, modules, 'returns', patch).find(
            (item) => item.path === edge.sourcePath,
        );
        return port
            ? {
                  compatible: true,
                  status: 'exact',
                  reason: 'The Output type follows this declared value.',
              }
            : fail('The source is not a declared value output.');
    }
    const input = nodePorts(target, modules, 'arguments', patch).find(
        (port) => port.path === edge.targetPath,
    );
    if (!input) return fail('The destination is not a declared input.');
    if (edge.kind === 'module') {
        if (source.kind !== 'module')
            return fail(
                "Only a module node has an implementation-reference outlet. Connect this node's value output.",
            );
        if (edge.sourcePath !== '')
            return fail(
                'A callable module reference uses its hash, not a result property.',
            );
        const module = modules.find((item) => item.key === source.moduleKey);
        return module
            ? compatibleModule(module, input)
            : fail('Load the exact module hash before connecting it.');
    }
    const output = nodePorts(source, modules, 'returns', patch).find(
        (port) => port.path === edge.sourcePath,
    );
    if (!output) return fail('The source is not a declared output.');
    return compatibleValues(output, input);
}

export function checkConnection(
    patch: Patch,
    modules: ModuleInfo[],
    edge: PatchConnection,
): string | null {
    if (edge.source === edge.target) return 'A node cannot connect to itself.';
    const compatibility = connectionCompatibility(patch, modules, edge);
    if (!compatibility.compatible) return compatibility.reason;
    if (
        patch.connections.some(
            (existing) =>
                existing.id !== edge.id &&
                existing.target === edge.target &&
                (ancestorPath(existing.targetPath, edge.targetPath) ||
                    ancestorPath(edge.targetPath, existing.targetPath)),
        )
    )
        return 'This input, or one of its parents, already has an incoming connection.';
    const outgoing = new Map<string, string[]>();
    for (const item of [
        ...patch.connections.filter((item) => item.id !== edge.id),
        edge,
    ])
        outgoing.set(item.source, [
            ...(outgoing.get(item.source) ?? []),
            item.target,
        ]);
    const pending = [edge.target];
    const visited = new Set<string>();
    while (pending.length) {
        const id = pending.pop()!;
        if (id === edge.source)
            return 'Connections must form an acyclic patch.';
        if (visited.has(id)) continue;
        visited.add(id);
        pending.push(...(outgoing.get(id) ?? []));
    }
    return null;
}

function arrayIndex(
    token: string,
    length: number,
    allowAppend: boolean,
): number {
    if (!/^(0|[1-9][0-9]*)$/u.test(token))
        throw new Error('An array input needs a numeric index.');
    const index = Number(token);
    if (
        !Number.isSafeInteger(index) ||
        index > length ||
        (!allowAppend && index === length)
    )
        throw new Error('Array inputs cannot contain missing elements.');
    return index;
}

/** Set only a value path, never an invocation context. Arrays stay dense. */
export function putPointer(
    original: JsonValue | undefined,
    pointer: string,
    value: JsonValue,
): JsonValue {
    const tokens = pointerTokens(pointer);
    if (!tokens.length) return structuredClone(value);
    const result = original === undefined ? {} : structuredClone(original);
    if (!object(result) && !Array.isArray(result))
        throw new Error('The containing input must be a record or list.');
    let current: JsonObject | JsonValue[] = result;
    for (const token of tokens.slice(0, -1)) {
        if (Array.isArray(current)) {
            const index = arrayIndex(token, current.length, true);
            if (index === current.length) current.push({});
        } else if (!Object.hasOwn(current, token)) current[token] = {};
        const child = (current as JsonObject)[token];
        if (!object(child) && !Array.isArray(child))
            throw new Error(`Input parent ${token} is not a record or list.`);
        current = child;
    }
    const token = tokens.at(-1)!;
    if (Array.isArray(current))
        current[arrayIndex(token, current.length, true)] =
            structuredClone(value);
    else current[token] = structuredClone(value);
    return result;
}

/** Disconnecting a source leaves its input unset, without resurrecting literals. */
export function removePointer(
    original: JsonValue | undefined,
    pointer: string,
): JsonValue | undefined {
    const tokens = pointerTokens(pointer);
    if (!tokens.length || original === undefined) return undefined;
    const result = structuredClone(original);
    let current = result;
    for (const token of tokens.slice(0, -1)) {
        if (
            (!object(current) && !Array.isArray(current)) ||
            !Object.hasOwn(current, token)
        )
            return result;
        current = (current as JsonObject)[token]!;
    }
    if (Array.isArray(current))
        throw new Error(
            'Connect the whole list or use a list composer; individual elements cannot become holes.',
        );
    if (object(current)) delete current[tokens.at(-1)!];
    return result;
}

export function withConnection(
    patch: Patch,
    modules: ModuleInfo[],
    edge: PatchConnection,
): Patch {
    const error = checkConnection(patch, modules, edge);
    if (error) throw new Error(error);
    const result = structuredClone(patch);
    const target = result.nodes.find((node) => node.id === edge.target)!;
    if (
        target.kind !== 'module' &&
        target.kind !== 'subpatch' &&
        target.kind !== 'output'
    )
        throw new Error('This node has no inputs.');
    if (target.kind !== 'output')
        target.arguments = removePointer(target.arguments, edge.targetPath);
    result.connections = [
        ...result.connections.filter((item) => item.id !== edge.id),
        structuredClone(edge),
    ];
    return result;
}

export function validatePatch(patch: Patch, modules: ModuleInfo[]): void {
    const budget = { nodes: 2048, connections: 8192 };
    const walk = (graph: Patch, depth: number) => {
        if (depth > 8)
            throw new Error('Subpatches may be nested at most eight levels.');
        if (graph.version !== 2) throw new Error('Expected a version 2 patch.');
        if (graph.nodes.length === 0)
            throw new Error('Add a node to the patch.');
        if (
            graph.nodes.length > 256 ||
            graph.connections.length > 1024 ||
            (budget.nodes -= graph.nodes.length) < 0 ||
            (budget.connections -= graph.connections.length) < 0
        )
            throw new Error('The patch is too large for this editor.');
        const ids = new Set<string>();
        const parameters = new Set<string>();
        const outputs = new Set<string>();
        for (const node of graph.nodes) {
            if (!validId(node.id))
                throw new Error(
                    'Node identifiers must be nonempty and cannot contain a slash.',
                );
            if (node.kind !== 'module' && !validName(node.name))
                throw new Error('Give each value or subpatch a nonempty name.');
            if (ids.has(node.id))
                throw new Error('Patch node identifiers must be unique.');
            ids.add(node.id);
            if (node.kind === 'module') {
                if (!modules.some((module) => module.key === node.moduleKey))
                    throw new Error(
                        `Missing module ${node.moduleKey}. Load that exact WASM module first.`,
                    );
            } else if (node.kind === 'subpatch') walk(node.patch, depth + 1);
            else if (node.kind === 'output') {
                if (outputs.has(node.name))
                    throw new Error(
                        'Output names must be unique within a patch.',
                    );
                outputs.add(node.name);
            } else if (node.kind === 'parameter') {
                if (parameters.has(node.name))
                    throw new Error('Patch parameter names must be unique.');
                parameters.add(node.name);
            }
            const value =
                node.kind === 'variable'
                    ? node.value
                    : node.kind === 'parameter'
                      ? node.default
                      : node.kind === 'output'
                        ? undefined
                        : node.arguments;
            if (value !== undefined) assertJsonNumbers(value, 'Node value');
        }
        const edges = new Set<string>();
        for (const edge of graph.connections) {
            if (edges.has(edge.id))
                throw new Error('Connection identifiers must be unique.');
            edges.add(edge.id);
            const error = checkConnection(graph, modules, edge);
            if (error) throw new Error(error);
            const target = graph.nodes.find((node) => node.id === edge.target)!;
            const literal =
                target.kind === 'module' || target.kind === 'subpatch'
                    ? target.arguments
                    : undefined;
            if (hasPointer(literal, edge.targetPath))
                throw new Error(
                    'A connected input also contains a local value. Remove the local value so it has one source.',
                );
        }
    };
    walk(patch, 0);
}

export function hasPointer(
    value: JsonValue | undefined,
    pointer: string,
): boolean {
    if (value === undefined) return false;
    let current = value;
    for (const token of pointerTokens(pointer)) {
        if (
            (!object(current) && !Array.isArray(current)) ||
            !Object.hasOwn(current, token)
        )
            return false;
        current = (current as JsonObject)[token]!;
    }
    return true;
}

/** One immutable run, with the same context inherited by every embedded patch. */
export async function runPatch(
    patch: Patch,
    modules: ModuleInfo[],
    outputNode: string | null,
    context: JsonValue,
    runtime: PatchRuntime,
    progress?: (progress: PatchProgress) => void,
    parameters: JsonObject = {},
): Promise<PatchResult> {
    const snapshot = structuredClone(patch);
    const catalog = structuredClone(modules);
    const runContext = structuredClone(context);
    const supplied = structuredClone(parameters);
    assertJsonNumbers(runContext, 'Compilation context');
    assertJsonNumbers(supplied, 'Patch parameters');
    validatePatch(snapshot, catalog);
    const values = new Map<string, JsonValue>();
    const executed: string[] = [];
    const trace: PatchInvocation[] = [];
    const validateValue = async (
        type: ValueType,
        value: JsonValue,
        label: string,
    ) => {
        assertJsonNumbers(value, label);
        const checked = await runtime.validateValue(
            standaloneSchema(type),
            structuredClone(value),
        );
        if (!checked.valid)
            throw new Error(`${label}: ${checked.errors.join('; ')}`);
    };
    const runGraph = async (
        graph: Patch,
        input: JsonObject,
        parentPath: string[],
        selection: string | null,
    ): Promise<JsonValue> => {
        const known = new Set(
            graph.nodes
                .filter((node) => node.kind === 'parameter')
                .map((node) => node.name),
        );
        for (const name of Object.keys(input))
            if (!known.has(name))
                throw new Error(`Unknown patch parameter ${name}.`);
        const local = new Map<string, JsonValue>();
        const evaluate = async (id: string): Promise<JsonValue> => {
            if (local.has(id)) return structuredClone(local.get(id)!);
            const node = graph.nodes.find((item) => item.id === id);
            if (!node)
                throw new Error(
                    'Select a node whose value you want to evaluate.',
                );
            const nodePath = [...parentPath, id];
            const progressId = nodePath.join('/');
            let value: JsonValue;
            if (node.kind === 'output') {
                const wire = graph.connections.find(
                    (edge) => edge.target === node.id,
                );
                if (!wire)
                    throw new Error(
                        `Connect a value to Output ${node.name} before building it.`,
                    );
                value = readPointer(
                    await evaluate(wire.source),
                    wire.sourcePath,
                );
            } else if (node.kind === 'variable' || node.kind === 'parameter') {
                const literal =
                    node.kind === 'variable'
                        ? node.value
                        : Object.hasOwn(input, node.name)
                          ? input[node.name]
                          : node.default;
                if (literal === undefined)
                    throw new Error(
                        `${node.name} is unset. Supply a ${node.kind === 'parameter' ? 'patch parameter' : 'variable value'}.`,
                    );
                await validateValue(node.type, literal, `Invalid ${node.name}`);
                value = structuredClone(literal);
            } else {
                let args = structuredClone(node.arguments);
                const incoming = graph.connections
                    .filter((edge) => edge.target === id)
                    .sort(
                        (a, b) =>
                            compareText(a.targetPath, b.targetPath) ||
                            compareText(a.source, b.source),
                    );
                for (const edge of incoming) {
                    const source = graph.nodes.find(
                        (item) => item.id === edge.source,
                    )!;
                    const wired =
                        edge.kind === 'module' && source.kind === 'module'
                            ? { which_plugin: { HashKey: source.moduleKey } }
                            : readPointer(
                                  await evaluate(edge.source),
                                  edge.sourcePath,
                              );
                    const port = nodePorts(
                        node,
                        catalog,
                        'arguments',
                        graph,
                    ).find((item) => item.path === edge.targetPath)!;
                    await validateValue(
                        port,
                        wired,
                        `Invalid value for ${port.label}`,
                    );
                    args = putPointer(args, edge.targetPath, wired);
                }
                if (args === undefined)
                    throw new Error(
                        `${node.label ?? (node.kind === 'module' ? catalog.find((item) => item.key === node.moduleKey)!.name : node.name)} has unset inputs.`,
                    );
                for (const port of nodePorts(
                    node,
                    catalog,
                    'arguments',
                    graph,
                )) {
                    if (port.kind !== 'module' || !hasPointer(args, port.path))
                        continue;
                    const reference = readPointer(args, port.path);
                    const locator = object(reference)
                        ? reference.which_plugin
                        : undefined;
                    const key = object(locator) ? locator.HashKey : undefined;
                    const implementation = catalog.find(
                        (item) => item.key === key,
                    );
                    if (!implementation)
                        throw new Error(
                            `Load the exact module used by ${port.label} before building.`,
                        );
                    const matched = compatibleModule(implementation, port);
                    if (!matched.compatible)
                        throw new Error(`${port.label}: ${matched.reason}`);
                }
                progress?.({ node: progressId, state: 'running' });
                if (node.kind === 'subpatch') {
                    await validateValue(
                        nodePorts(node, catalog, 'arguments', graph)[0]!,
                        args,
                        `Invalid inputs for ${node.name}`,
                    );
                    if (!object(args))
                        throw new Error('Subpatch inputs must be a record.');
                    value = await runGraph(node.patch, args, nodePath, null);
                } else {
                    const defaultContext = structuredClone(runContext);
                    const invocationContext = runtime.contextForNode
                        ? runtime.contextForNode([...nodePath], defaultContext)
                        : defaultContext;
                    assertJsonNumbers(invocationContext, 'Compilation context');
                    const invocation = {
                        arguments: args,
                        context: structuredClone(invocationContext),
                    };
                    const checked = await runtime.validate(
                        node.moduleKey,
                        'arguments',
                        structuredClone(invocation),
                    );
                    if (!checked.valid)
                        throw new Error(
                            `Invalid arguments for ${catalog.find((module) => module.key === node.moduleKey)!.name}: ${checked.errors.join('; ')}`,
                        );
                    const invokedWith = structuredClone(invocation);
                    value = await runtime.invoke(node.moduleKey, invocation);
                    assertJsonNumbers(value, 'Module result');
                    const output = await runtime.validate(
                        node.moduleKey,
                        'returns',
                        structuredClone(value),
                    );
                    if (!output.valid)
                        throw new Error(
                            `The module result violates its advertised API: ${output.errors.join('; ')}`,
                        );
                    executed.push(progressId);
                    trace.push({
                        nodePath,
                        moduleKey: node.moduleKey,
                        args: invokedWith,
                        result: structuredClone(value),
                    });
                }
            }
            local.set(id, structuredClone(value));
            values.set(progressId, structuredClone(value));
            progress?.({
                node: progressId,
                state: 'complete',
                value: structuredClone(value),
            });
            return structuredClone(value);
        };
        if (selection !== null) return evaluate(selection);
        const outputs = patchOutputs(graph);
        if (!outputs.length)
            throw new Error(
                'Add an Output node and wire the value you want to build.',
            );
        const result: JsonObject = {};
        for (const output of outputs.sort((a, b) =>
            compareText(a.name, b.name),
        ))
            result[output.name] = await evaluate(output.id);
        return result;
    };
    const output = await runGraph(snapshot, supplied, [], outputNode);
    return { output, values, executed, trace };
}

function validName(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 128 &&
        !['__proto__', 'prototype', 'constructor'].includes(value)
    );
}

function validId(value: unknown): value is string {
    return validName(value) && !value.includes('/');
}

export function parsePatch(text: string): PatchFile {
    if (text.length > 8 * 1024 * 1024)
        throw new Error('Patch file is larger than 8 MiB.');
    const value: unknown = JSON.parse(text);
    const budget = { nodes: 2048, connections: 8192 };
    const walk = (graph: unknown, depth: number): void => {
        if (depth > 8)
            throw new Error('Subpatches may be nested at most eight levels.');
        if (
            !object(graph) ||
            graph.version !== 2 ||
            !Array.isArray(graph.nodes) ||
            !Array.isArray(graph.connections) ||
            Object.hasOwn(graph, 'outputs') ||
            Object.hasOwn(graph, 'output')
        )
            throw new Error(
                'Expected a version 2 Sapio patch with wired Output nodes.',
            );
        const nodeKinds = new Map<string, string>();
        const outputNames = new Set<string>();
        const parameterNames = new Set<string>();
        if (
            graph.nodes.length > 256 ||
            graph.connections.length > 1024 ||
            (budget.nodes -= graph.nodes.length) < 0 ||
            (budget.connections -= graph.connections.length) < 0
        )
            throw new Error('The patch is too large for this editor.');
        for (const node of graph.nodes) {
            if (
                !object(node) ||
                !validId(node.id) ||
                (node.label !== undefined && typeof node.label !== 'string') ||
                !object(node.position) ||
                typeof node.position.x !== 'number' ||
                typeof node.position.y !== 'number' ||
                !Number.isFinite(node.position.x) ||
                !Number.isFinite(node.position.y)
            )
                throw new Error('Invalid patch node.');
            if (nodeKinds.has(node.id))
                throw new Error('Patch node identifiers must be unique.');
            if (node.kind === 'module') {
                if (
                    typeof node.moduleKey !== 'string' ||
                    !/^[0-9a-f]{64}$/u.test(node.moduleKey)
                )
                    throw new Error('Invalid exact module hash.');
            } else if (node.kind === 'variable' || node.kind === 'parameter') {
                if (
                    !validName(node.name) ||
                    !object(node.type) ||
                    !(
                        object(node.type.schema) ||
                        typeof node.type.schema === 'boolean'
                    ) ||
                    !(
                        node.type.root === undefined ||
                        object(node.type.root) ||
                        typeof node.type.root === 'boolean'
                    )
                )
                    throw new Error('Invalid typed value node.');
                if (node.kind === 'parameter') {
                    if (parameterNames.has(node.name))
                        throw new Error(
                            'Patch parameter names must be unique.',
                        );
                    parameterNames.add(node.name);
                }
            } else if (node.kind === 'subpatch') {
                if (!validName(node.name))
                    throw new Error('Invalid subpatch name.');
                walk(node.patch, depth + 1);
            } else if (node.kind === 'output') {
                if (
                    !validName(node.name) ||
                    ['arguments', 'value', 'default', 'type'].some((key) =>
                        Object.hasOwn(node, key),
                    )
                )
                    throw new Error(
                        'An Output needs a name and one incoming value wire.',
                    );
                if (outputNames.has(node.name))
                    throw new Error(
                        'Output names must be unique within a patch.',
                    );
                outputNames.add(node.name);
            } else throw new Error('Unknown patch node kind.');
            nodeKinds.set(node.id, String(node.kind));
        }
        for (const edge of graph.connections) {
            if (
                !object(edge) ||
                !validName(edge.id) ||
                !['value', 'module'].includes(String(edge.kind)) ||
                !validId(edge.source) ||
                !validId(edge.target) ||
                typeof edge.sourcePath !== 'string' ||
                typeof edge.targetPath !== 'string'
            )
                throw new Error('Invalid patch connection.');
            if (!nodeKinds.has(edge.source) || !nodeKinds.has(edge.target))
                throw new Error('A connection references an unknown node.');
            if (nodeKinds.get(edge.source) === 'output')
                throw new Error('An Output cannot have outgoing connections.');
            if (
                nodeKinds.get(edge.target) === 'output' &&
                (edge.kind !== 'value' || edge.targetPath !== '')
            )
                throw new Error(
                    'An Output accepts one complete value through a value wire.',
                );
            pointerTokens(edge.sourcePath);
            pointerTokens(edge.targetPath);
        }
    };
    walk(value, 0);
    if (!object(value) || !Object.hasOwn(value, 'context'))
        throw new Error('A saved patch needs an explicit compilation context.');
    assertJsonNumbers(value, 'Patch data');
    return value as unknown as PatchFile;
}
