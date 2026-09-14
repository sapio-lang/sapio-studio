import type {
    JsonObject,
    JsonSchema,
    JsonValue,
    ModuleInfo,
} from '../../shared/studio';

export interface SchemaPort {
    path: string;
    label: string;
    schema: JsonSchema;
    root: JsonSchema;
    kind: 'value' | 'module';
}

export function object(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function pointerTokens(pointer: string): string[] {
    if (pointer === '') return [];
    if (!pointer.startsWith('/') || /~(?:[^01]|$)/u.test(pointer)) {
        throw new Error(`Invalid JSON pointer: ${pointer}`);
    }
    const tokens = pointer
        .slice(1)
        .split('/')
        .map((token) => token.replace(/~1/gu, '/').replace(/~0/gu, '~'));
    if (
        tokens.some((token) =>
            ['__proto__', 'prototype', 'constructor'].includes(token),
        )
    ) {
        throw new Error('Reserved property in JSON pointer');
    }
    return tokens;
}

export function escapePointer(value: string): string {
    return value.replace(/~/gu, '~0').replace(/\//gu, '~1');
}

export function readPointer(value: JsonValue, pointer: string): JsonValue {
    let current = value;
    for (const token of pointerTokens(pointer)) {
        if (
            (!object(current) && !Array.isArray(current)) ||
            !Object.hasOwn(current, token)
        ) {
            throw new Error(`Output has no value at ${pointer || '/'}`);
        }
        current = (current as JsonObject)[token]!;
    }
    return current;
}

/** Local Draft 7 references only. Unknown combinations remain opaque. */
export function resolveSchema(
    schema: JsonSchema,
    root: JsonSchema,
    visited = new Set<string>(),
): JsonSchema {
    if (!object(schema)) return schema;
    if (typeof schema.$ref === 'string') {
        if (!schema.$ref.startsWith('#/') || visited.has(schema.$ref))
            return schema;
        const next = new Set(visited).add(schema.$ref);
        try {
            const target = readPointer(root, schema.$ref.slice(1));
            if (object(target) || typeof target === 'boolean')
                return resolveSchema(target, root, next);
        } catch {
            /* An unresolved reference cannot establish compatibility. */
        }
        return schema;
    }
    if (
        Array.isArray(schema.allOf) &&
        schema.allOf.length === 1 &&
        Object.keys(schema).every((key) =>
            ['allOf', 'title', 'description', 'default', 'examples'].includes(
                key,
            ),
        )
    ) {
        const child = schema.allOf[0];
        if (object(child) || typeof child === 'boolean')
            return resolveSchema(child, root, visited);
    }
    return schema;
}

function asSchema(value: JsonValue | undefined): JsonSchema | undefined {
    return typeof value === 'boolean' || object(value) ? value : undefined;
}

function moduleSocket(schema: JsonSchema, root: JsonSchema): boolean {
    const resolved = resolveSchema(schema, root);
    if (
        !object(resolved) ||
        !object(resolved.properties) ||
        !Array.isArray(resolved.required) ||
        !resolved.required.includes('which_plugin')
    )
        return false;
    const locator = asSchema(resolved.properties.which_plugin);
    if (locator === undefined) return false;
    const shape = resolveSchema(locator, root);
    return (
        object(shape) &&
        Array.isArray(shape.oneOf) &&
        shape.oneOf.some(
            (alternative) =>
                object(alternative) &&
                object(alternative.properties) &&
                object(alternative.properties.HashKey) &&
                alternative.properties.HashKey.type === 'string',
        )
    );
}

export function modulePorts(
    module: ModuleInfo,
    side: 'arguments' | 'returns',
): SchemaPort[] {
    const root = module.api[side];
    const envelope = resolveSchema(root, root);
    const initial =
        side === 'arguments' && object(envelope) && object(envelope.properties)
            ? asSchema(envelope.properties.arguments)
            : root;
    if (initial === undefined) return [];
    const ports: SchemaPort[] = [];
    const walk = (schema: JsonSchema, path: string, depth: number) => {
        if (ports.length >= 96) return;
        const resolved = resolveSchema(schema, root);
        const kind = moduleSocket(schema, root) ? 'module' : 'value';
        ports.push({
            path,
            label: path || (side === 'arguments' ? 'arguments' : 'result'),
            schema,
            root,
            kind,
        });
        if (kind === 'module' || depth >= 4 || !object(resolved)) return;
        if (object(resolved.properties)) {
            for (const [name, value] of Object.entries(resolved.properties)) {
                const child = asSchema(value);
                if (child !== undefined)
                    walk(child, `${path}/${escapePointer(name)}`, depth + 1);
            }
        }
        // Tagged enum variants have distinct object properties. Expose each
        // argument branch without pretending the branch itself is selected.
        for (const keyword of ['oneOf', 'anyOf']) {
            const alternatives = resolved[keyword];
            if (!Array.isArray(alternatives)) continue;
            for (const alternative of alternatives) {
                const branch = asSchema(alternative);
                const shape =
                    branch === undefined
                        ? undefined
                        : resolveSchema(branch, root);
                if (!object(shape) || !object(shape.properties)) continue;
                for (const [name, value] of Object.entries(shape.properties)) {
                    const child = asSchema(value);
                    const pointer = `${path}/${escapePointer(name)}`;
                    if (
                        child !== undefined &&
                        !ports.some((port) => port.path === pointer)
                    )
                        walk(child, pointer, depth + 1);
                }
            }
        }
    };
    walk(initial, '', 0);
    return ports;
}

const annotations = new Set([
    '$schema',
    '$id',
    'title',
    'description',
    'default',
    'examples',
    'readOnly',
    'writeOnly',
    '$comment',
]);

function canonical(value: JsonValue): string {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (object(value))
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${canonical(value[key]!)}`)
            .join(',')}}`;
    return JSON.stringify(value);
}

/** Equal local schemas are a useful sufficient condition, not subtyping. */
function normalized(
    schema: JsonSchema,
    root: JsonSchema,
    depth = 0,
    budget = { remaining: 2048 },
): JsonValue | undefined {
    if (depth > 24 || budget.remaining-- <= 0) return undefined;
    const resolved = resolveSchema(schema, root);
    if (!object(resolved)) return resolved;
    if ('$ref' in resolved) return undefined;
    const output: JsonObject = {};
    for (const [key, value] of Object.entries(resolved)) {
        if (
            annotations.has(key) ||
            key === 'definitions' ||
            key === '$defs' ||
            key.startsWith('x-')
        )
            continue;
        if (
            [
                'properties',
                'patternProperties',
                'dependentSchemas',
                'dependencies',
            ].includes(key) &&
            object(value)
        ) {
            const properties: JsonObject = {};
            for (const [property, child] of Object.entries(value)) {
                if (key === 'dependencies' && Array.isArray(child)) {
                    if (!child.every((name) => typeof name === 'string'))
                        return undefined;
                    properties[property] = child;
                    continue;
                }
                const childSchema = asSchema(child);
                const result =
                    childSchema === undefined
                        ? undefined
                        : normalized(childSchema, root, depth + 1, budget);
                if (result === undefined) return undefined;
                properties[property] = result;
            }
            output[key] = properties;
        } else if (
            ['allOf', 'anyOf', 'oneOf', 'items', 'prefixItems'].includes(key) &&
            Array.isArray(value)
        ) {
            const children: JsonValue[] = [];
            for (const child of value) {
                const childSchema = asSchema(child);
                const result =
                    childSchema === undefined
                        ? undefined
                        : normalized(childSchema, root, depth + 1, budget);
                if (result === undefined) return undefined;
                children.push(result);
            }
            output[key] = children;
        } else if (
            [
                'items',
                'additionalItems',
                'additionalProperties',
                'contains',
                'not',
                'if',
                'then',
                'else',
                'propertyNames',
            ].includes(key)
        ) {
            const childSchema = asSchema(value);
            const result =
                childSchema === undefined
                    ? undefined
                    : normalized(childSchema, root, depth + 1, budget);
            if (result === undefined) return undefined;
            output[key] = result;
        } else output[key] = value;
    }
    return output;
}

export interface Compatibility {
    compatible: boolean;
    reason: string;
}

export function compatibleValues(
    source: SchemaPort,
    target: SchemaPort,
): Compatibility {
    if (target.kind === 'module')
        return {
            compatible: false,
            reason: 'Use the module outlet for this reference socket.',
        };
    const from = normalized(source.schema, source.root);
    const to = normalized(target.schema, target.root);
    if (
        from !== undefined &&
        to !== undefined &&
        canonical(from) === canonical(to)
    ) {
        return {
            compatible: true,
            reason: 'Matching JSON schemas; actual values are checked before execution.',
        };
    }
    const a = resolveSchema(source.schema, source.root);
    const b = resolveSchema(target.schema, target.root);
    if (
        b === true ||
        (object(b) && Object.keys(b).every((key) => annotations.has(key)))
    ) {
        return {
            compatible: true,
            reason: 'This input accepts any JSON value.',
        };
    }
    // Permit a constrained scalar to enter an unconstrained scalar socket.
    // Complex intersections, unions, recursive schemas and coercions are never
    // guessed. The user can always author an explicit adapter module.
    if (
        object(a) &&
        object(b) &&
        !('$ref' in a) &&
        typeof a.type === 'string' &&
        typeof b.type === 'string' &&
        ['string', 'integer', 'number', 'boolean', 'null'].includes(a.type) &&
        (a.type === b.type || (a.type === 'integer' && b.type === 'number')) &&
        Object.keys(b).every((key) => key === 'type' || annotations.has(key))
    ) {
        return {
            compatible: true,
            reason: 'The output scalar fits this input type.',
        };
    }
    return {
        compatible: false,
        reason: 'These schemas are not provably compatible. Use an explicit adapter or edit the arguments.',
    };
}

export function schemaLabel(port: SchemaPort): string {
    if (port.kind === 'module') return 'module reference';
    const schema = resolveSchema(port.schema, port.root);
    if (!object(schema)) return schema ? 'JSON' : 'never';
    if (typeof schema.type === 'string') return schema.type;
    if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf))
        return 'choice';
    return 'JSON';
}

export function initialArguments(module: ModuleInfo): JsonValue {
    const rootPort = modulePorts(module, 'arguments')[0];
    if (!rootPort) return {};
    const seed = (schema: JsonSchema, depth: number): JsonValue => {
        const resolved = resolveSchema(schema, rootPort.root);
        if (!object(resolved) || depth > 8) return null;
        if (Object.hasOwn(resolved, 'default'))
            return structuredClone(resolved.default!);
        if (Object.hasOwn(resolved, 'const'))
            return structuredClone(resolved.const!);
        if (Array.isArray(resolved.enum) && resolved.enum.length > 0)
            return structuredClone(resolved.enum[0]!);
        if (object(resolved.properties)) {
            const result: JsonObject = {};
            for (const name of Array.isArray(resolved.required)
                ? resolved.required
                : []) {
                if (typeof name !== 'string') continue;
                const child = asSchema(resolved.properties[name]);
                if (child !== undefined) result[name] = seed(child, depth + 1);
            }
            return result;
        }
        const alternative = (
            Array.isArray(resolved.oneOf)
                ? resolved.oneOf
                : Array.isArray(resolved.anyOf)
                  ? resolved.anyOf
                  : []
        )[0];
        const branch = asSchema(alternative);
        if (branch !== undefined) return seed(branch, depth + 1);
        if (resolved.type === 'array') return [];
        if (resolved.type === 'string') return '';
        if (resolved.type === 'integer' || resolved.type === 'number')
            return typeof resolved.minimum === 'number' ? resolved.minimum : 0;
        if (resolved.type === 'boolean') return false;
        return null;
    };
    return seed(rootPort.schema, 0);
}
