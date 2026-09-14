import type { JsonObject, JsonValue, ModuleInfo } from '../../shared/studio';
import {
    compatibleValues,
    modulePorts,
    object,
    pointerTokens,
    readPointer,
} from './schema';

export interface PatchNode {
    id: string;
    moduleKey: string;
    arguments: JsonValue;
    position: { x: number; y: number };
}
export interface PatchConnection {
    id: string;
    kind: 'value' | 'module';
    source: string;
    sourcePath: string;
    target: string;
    targetPath: string;
}
export interface Patch {
    version: 1;
    nodes: PatchNode[];
    connections: PatchConnection[];
}
export interface PatchFile extends Patch {
    context: JsonValue;
}
export interface PatchRuntime {
    invoke(
        key: string,
        args: { arguments: JsonValue; context: JsonValue },
    ): Promise<JsonValue>;
    validate(
        key: string,
        side: 'arguments' | 'returns',
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
            ) {
                throw new Error(
                    `${label} contains a number outside JavaScript's exact integer range. Use a module API with a string representation for larger integers.`,
                );
            }
        } else if (Array.isArray(next)) {
            for (const item of next) pending.push(item);
        } else if (object(next)) {
            for (const item of Object.values(next)) pending.push(item);
        }
    }
}

function ancestorPath(a: string, b: string): boolean {
    return a === b || a === '' || b.startsWith(`${a}/`);
}

export function checkConnection(
    patch: Patch,
    modules: ModuleInfo[],
    edge: PatchConnection,
): string | null {
    const source = patch.nodes.find((node) => node.id === edge.source);
    const target = patch.nodes.find((node) => node.id === edge.target);
    if (!source || !target) return 'Both modules must exist in the patch.';
    if (source.id === target.id) return 'A module cannot connect to itself.';
    const sourceModule = modules.find(
        (module) => module.key === source.moduleKey,
    );
    const targetModule = modules.find(
        (module) => module.key === target.moduleKey,
    );
    if (!sourceModule || !targetModule)
        return 'Load the exact module hashes before wiring this patch.';
    const input = modulePorts(targetModule, 'arguments').find(
        (port) => port.path === edge.targetPath,
    );
    if (!input) return 'The destination is not an advertised argument socket.';
    if (edge.kind === 'module') {
        if (input.kind !== 'module')
            return 'Module outlets can only enter module-reference sockets.';
        if (edge.sourcePath !== '')
            return 'A module reference uses its hash, not a result property.';
    } else {
        const output = modulePorts(sourceModule, 'returns').find(
            (port) => port.path === edge.sourcePath,
        );
        if (!output) return 'The source is not an advertised result socket.';
        const compatibility = compatibleValues(output, input);
        if (!compatibility.compatible) return compatibility.reason;
    }
    if (
        patch.connections.some(
            (existing) =>
                existing.id !== edge.id &&
                existing.target === edge.target &&
                (ancestorPath(existing.targetPath, edge.targetPath) ||
                    ancestorPath(edge.targetPath, existing.targetPath)),
        )
    ) {
        return 'This argument, or one of its parents, already has an incoming connection.';
    }
    const outgoing = new Map<string, string[]>();
    for (const item of [
        ...patch.connections.filter((item) => item.id !== edge.id),
        edge,
    ]) {
        outgoing.set(item.source, [
            ...(outgoing.get(item.source) ?? []),
            item.target,
        ]);
    }
    const pending = [edge.target];
    const visited = new Set<string>();
    while (pending.length > 0) {
        const node = pending.pop()!;
        if (node === edge.source)
            return 'Connections must form an acyclic patch.';
        if (visited.has(node)) continue;
        visited.add(node);
        pending.push(...(outgoing.get(node) ?? []));
    }
    return null;
}

/** Overwrite a declared argument only; never reach the invocation context. */
function putPointer(
    original: JsonValue,
    pointer: string,
    value: JsonValue,
): JsonValue {
    const tokens = pointerTokens(pointer);
    if (tokens.length === 0) return structuredClone(value);
    const result = structuredClone(original);
    if (!object(result) && !Array.isArray(result))
        throw new Error(
            'Wire a complete argument value or initialize its containing object.',
        );
    let current = result as JsonObject;
    for (const token of tokens.slice(0, -1)) {
        if (!Object.hasOwn(current, token)) current[token] = {};
        const child = current[token];
        if (!object(child) && !Array.isArray(child))
            throw new Error(
                `Argument parent ${token} is not an object or array.`,
            );
        current = child as JsonObject;
    }
    current[tokens[tokens.length - 1]!] = structuredClone(value);
    return result;
}

export function validatePatch(patch: Patch, modules: ModuleInfo[]): void {
    if (patch.nodes.length === 0) throw new Error('Add a module to the patch.');
    const ids = new Set<string>();
    for (const node of patch.nodes) {
        assertJsonNumbers(node.arguments, 'Module arguments');
        if (ids.has(node.id))
            throw new Error('Patch node identifiers must be unique.');
        ids.add(node.id);
        if (!modules.some((module) => module.key === node.moduleKey))
            throw new Error(
                `Missing module ${node.moduleKey}. Load that exact WASM module first.`,
            );
    }
    const edges = new Set<string>();
    for (const edge of patch.connections) {
        if (edges.has(edge.id))
            throw new Error('Connection identifiers must be unique.');
        edges.add(edge.id);
        const error = checkConnection(patch, modules, edge);
        if (error) throw new Error(error);
    }
}

/** Evaluate just the selected result and its value dependencies, once each. */
export async function runPatch(
    patch: Patch,
    modules: ModuleInfo[],
    outputNode: string,
    context: JsonValue,
    runtime: PatchRuntime,
    progress?: (progress: PatchProgress) => void,
): Promise<PatchResult> {
    // Freeze one run: editing a node while a CLI request is pending must not
    // change the parameters of another node within that invocation.
    const snapshot = structuredClone(patch);
    const runContext = structuredClone(context);
    assertJsonNumbers(runContext, 'Compilation context');
    validatePatch(snapshot, modules);
    if (!snapshot.nodes.some((node) => node.id === outputNode))
        throw new Error('Select the module whose result you want to build.');
    const values = new Map<string, JsonValue>();
    const executed: string[] = [];
    const evaluate = async (id: string): Promise<JsonValue> => {
        if (values.has(id)) return values.get(id)!;
        const node = snapshot.nodes.find((item) => item.id === id)!;
        let args = structuredClone(node.arguments);
        const incoming = snapshot.connections.filter(
            (edge) => edge.target === id,
        );
        for (const edge of incoming) {
            const source = snapshot.nodes.find(
                (item) => item.id === edge.source,
            )!;
            const value: JsonValue =
                edge.kind === 'module'
                    ? { which_plugin: { HashKey: source.moduleKey } }
                    : readPointer(await evaluate(edge.source), edge.sourcePath);
            args = putPointer(args, edge.targetPath, value);
        }
        const input = { arguments: args, context: structuredClone(runContext) };
        const checked = await runtime.validate(
            node.moduleKey,
            'arguments',
            input,
        );
        if (!checked.valid)
            throw new Error(
                `Invalid arguments for ${modules.find((module) => module.key === node.moduleKey)!.name}: ${checked.errors.join('; ')}`,
            );
        progress?.({ node: id, state: 'running' });
        const value = await runtime.invoke(node.moduleKey, input);
        assertJsonNumbers(value, 'Module result');
        const output = await runtime.validate(node.moduleKey, 'returns', value);
        if (!output.valid)
            throw new Error(
                `The module result violates its advertised API: ${output.errors.join('; ')}`,
            );
        values.set(id, structuredClone(value));
        executed.push(id);
        progress?.({ node: id, state: 'complete', value });
        return value;
    };
    const output = await evaluate(outputNode);
    return { output, values, executed };
}

export function parsePatch(text: string): PatchFile {
    if (text.length > 8 * 1024 * 1024)
        throw new Error('Patch file is larger than 8 MiB.');
    const value: unknown = JSON.parse(text);
    if (
        !object(value) ||
        value.version !== 1 ||
        !Array.isArray(value.nodes) ||
        !Array.isArray(value.connections) ||
        !Object.hasOwn(value, 'context')
    )
        throw new Error(
            'Expected a Sapio patch with version 1 and an explicit context.',
        );
    if (value.nodes.length > 256 || value.connections.length > 1024)
        throw new Error('The patch is too large for this editor.');
    for (const node of value.nodes) {
        if (
            !object(node) ||
            typeof node.id !== 'string' ||
            typeof node.moduleKey !== 'string' ||
            !/^[0-9a-f]{64}$/u.test(node.moduleKey) ||
            !Object.hasOwn(node, 'arguments') ||
            !object(node.position) ||
            typeof node.position.x !== 'number' ||
            typeof node.position.y !== 'number' ||
            !Number.isFinite(node.position.x) ||
            !Number.isFinite(node.position.y)
        )
            throw new Error('Invalid patch module.');
        assertJsonNumbers(node.arguments!, 'Module arguments');
    }
    for (const edge of value.connections) {
        if (
            !object(edge) ||
            typeof edge.id !== 'string' ||
            !['value', 'module'].includes(String(edge.kind)) ||
            typeof edge.source !== 'string' ||
            typeof edge.target !== 'string' ||
            typeof edge.sourcePath !== 'string' ||
            typeof edge.targetPath !== 'string'
        )
            throw new Error('Invalid patch connection.');
        pointerTokens(edge.sourcePath);
        pointerTokens(edge.targetPath);
    }
    assertJsonNumbers(value.context!, 'Compilation context');
    return value as unknown as PatchFile;
}
