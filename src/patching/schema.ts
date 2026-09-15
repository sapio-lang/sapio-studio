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
    required?: boolean;
}

export interface ValueType {
    schema: JsonSchema;
    root?: JsonSchema;
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
            if (object(target) || typeof target === 'boolean') {
                const resolved = resolveSchema(target, root, next);
                return withAnnotations(resolved, schema);
            }
        } catch {
            /* An unresolved reference cannot establish compatibility. */
        }
        return schema;
    }
    if (
        Array.isArray(schema.allOf) &&
        schema.allOf.length === 1 &&
        Object.keys(schema).every(
            (key) =>
                [
                    'allOf',
                    'title',
                    'description',
                    'default',
                    'examples',
                    '$schema',
                ].includes(key) || key.startsWith('x-'),
        )
    ) {
        const child = schema.allOf[0];
        if (object(child) || typeof child === 'boolean')
            return withAnnotations(resolveSchema(child, root, visited), schema);
    }
    return schema;
}

function withAnnotations(resolved: JsonSchema, source: JsonObject): JsonSchema {
    if (
        !object(resolved) &&
        !Object.keys(source).some((key) => key.startsWith('x-'))
    )
        return resolved;
    const result: JsonObject = object(resolved)
        ? { ...resolved }
        : { allOf: [resolved] };
    for (const [key, value] of Object.entries(source)) {
        if (
            ['title', 'description', 'default', 'examples'].includes(key) ||
            key.startsWith('x-')
        )
            result[key] = value;
    }
    return result;
}

/** Relocate local schema references without rewriting defaults or API annotations. */
export function rebaseSchema(schema: JsonSchema, prefix: string): JsonSchema {
    if (!object(schema)) return schema;
    const maps = new Set([
        'properties',
        'patternProperties',
        'definitions',
        '$defs',
        'dependentSchemas',
    ]);
    const lists = new Set(['allOf', 'oneOf', 'anyOf', 'prefixItems']);
    const singles = new Set([
        'items',
        'additionalItems',
        'additionalProperties',
        'contains',
        'not',
        'if',
        'then',
        'else',
        'propertyNames',
    ]);
    const result: JsonObject = {};
    for (const [key, child] of Object.entries(schema)) {
        if (
            key === '$ref' &&
            typeof child === 'string' &&
            child.startsWith('#')
        ) {
            result[key] = `${prefix}${child.slice(1)}`;
        } else if (maps.has(key) && object(child)) {
            result[key] = Object.fromEntries(
                Object.entries(child).map(([name, field]) => {
                    const value = asSchema(field);
                    return [
                        name,
                        value === undefined
                            ? structuredClone(field)
                            : rebaseSchema(value, prefix),
                    ];
                }),
            );
        } else if (
            (lists.has(key) || key === 'items') &&
            Array.isArray(child)
        ) {
            result[key] = child.map((field) => {
                const value = asSchema(field);
                return value === undefined
                    ? structuredClone(field)
                    : rebaseSchema(value, prefix);
            });
        } else if (singles.has(key) && asSchema(child) !== undefined) {
            result[key] = rebaseSchema(child as JsonSchema, prefix);
        } else if (key === 'dependencies' && object(child)) {
            result[key] = Object.fromEntries(
                Object.entries(child).map(([name, field]) => [
                    name,
                    Array.isArray(field)
                        ? structuredClone(field)
                        : rebaseSchema(field as JsonSchema, prefix),
                ]),
            );
        } else result[key] = structuredClone(child);
    }
    return result;
}

/** Preserve a selected field's reference environment when validating it alone. */
export function standaloneSchema(type: ValueType): JsonSchema {
    if (type.root === undefined || type.root === type.schema)
        return structuredClone(type.schema);
    const selected = rebaseSchema(type.schema, '#/$defs/__sapio_root');
    if (!object(selected)) return selected;
    const schema: JsonObject = {
        ...selected,
        $defs: {
            ...(object(selected.$defs) ? selected.$defs : {}),
            __sapio_root: rebaseSchema(type.root, '#/$defs/__sapio_root'),
        },
    };
    if (object(type.root) && typeof type.root.$schema === 'string')
        schema.$schema = type.root.$schema;
    return schema;
}

/** Independent field roots remain independent when composing a record API. */
export function recordType(
    fields: { name: string; type: ValueType; required: boolean }[],
): ValueType {
    const properties: JsonObject = {};
    const definitions: JsonObject = {};
    const required: string[] = [];
    fields.forEach((field, index) => {
        const definition = `field_${index}`;
        definitions[definition] = rebaseSchema(
            standaloneSchema(field.type),
            `#/$defs/${definition}`,
        );
        properties[field.name] = { $ref: `#/$defs/${definition}` };
        if (field.required) required.push(field.name);
    });
    return {
        schema: {
            type: 'object',
            properties,
            required,
            additionalProperties: false,
            $defs: definitions,
        },
    };
}

export function asSchema(value: JsonValue | undefined): JsonSchema | undefined {
    return typeof value === 'boolean' || object(value) ? value : undefined;
}

function moduleSocket(schema: JsonSchema, root: JsonSchema): boolean {
    const resolved = resolveSchema(schema, root);
    return object(resolved) && Object.hasOwn(resolved, 'x-sapio-module');
}

export function humanize(value: string): string {
    const words = value
        .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
        .replace(/[_-]+/gu, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
}

export function modulePorts(
    module: ModuleInfo,
    side: 'arguments' | 'returns',
): SchemaPort[] {
    const root = module.api[side];
    const envelope = resolveSchema(root, root);
    let initial =
        side === 'arguments' && object(envelope) && object(envelope.properties)
            ? asSchema(envelope.properties.arguments)
            : root;
    if (initial === undefined) return [];
    if (
        side === 'arguments' &&
        object(initial) &&
        (typeof initial.$ref === 'string' ||
            (Array.isArray(initial.allOf) &&
                initial.allOf.length === 1 &&
                object(initial.allOf[0]) &&
                typeof initial.allOf[0].$ref === 'string'))
    ) {
        // The envelope names a field, not the referenced payload's type.
        initial = { ...initial };
        delete initial.title;
    }
    return valuePorts({ schema: initial, root }, side);
}

/** Only declared fields are sockets; JSON Pointers remain an internal address. */
export function valuePorts(
    type: ValueType,
    side: 'arguments' | 'returns' = 'returns',
): SchemaPort[] {
    const root = type.root ?? type.schema;
    const ports: SchemaPort[] = [];
    const walk = (
        schema: JsonSchema,
        path: string,
        depth: number,
        required = true,
    ) => {
        if (ports.length >= 96) return;
        const resolved = resolveSchema(schema, root);
        const kind = moduleSocket(schema, root) ? 'module' : 'value';
        ports.push({
            path,
            label: path
                ? object(schema) && typeof schema.title === 'string'
                    ? schema.title
                    : humanize(pointerTokens(path).at(-1)!)
                : side === 'arguments'
                  ? 'Inputs'
                  : 'Value',
            schema,
            root,
            kind,
            required,
        });
        if (kind === 'module' || depth >= 4 || !object(resolved)) return;
        if (object(resolved.properties)) {
            for (const [name, value] of Object.entries(resolved.properties)) {
                const child = asSchema(value);
                if (child !== undefined)
                    walk(
                        child,
                        `${path}/${escapePointer(name)}`,
                        depth + 1,
                        Array.isArray(resolved.required) &&
                            resolved.required.includes(name),
                    );
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
                        walk(
                            child,
                            pointer,
                            depth + 1,
                            Array.isArray(shape.required) &&
                                shape.required.includes(name),
                        );
                }
            }
        }
    };
    walk(type.schema, '', 0);
    return ports;
}

const annotations = new Set([
    '$schema',
    '$id',
    'title',
    'description',
    'default',
    'examples',
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
export function normalized(
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
        if (annotations.has(key) || key === 'definitions' || key === '$defs')
            continue;
        if (
            key === 'required' &&
            Array.isArray(value) &&
            value.every((name) => typeof name === 'string')
        ) {
            output[key] = [...new Set(value)].sort();
        } else if (key === 'x-sapio-module' && object(value)) {
            const signature: JsonObject = {};
            for (const side of ['arguments', 'returns']) {
                const part = asSchema(value[side]);
                const result =
                    part === undefined
                        ? undefined
                        : normalized(part, part, depth + 1, budget);
                if (result === undefined) return undefined;
                signature[side] = result;
            }
            output[key] = signature;
        } else if (
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
    status: 'exact' | 'checked-at-build' | 'incompatible';
    reason: string;
}

function mismatch(reason: string): Compatibility {
    return { compatible: false, status: 'incompatible', reason };
}

/** Exact local schema graph equality, including productive recursive types. */
export function sameSchema(a: ValueType, b: ValueType): boolean {
    const budget = { remaining: 65536 };
    const compare = (
        left: ValueType,
        right: ValueType,
        nesting: number,
    ): boolean => {
        const leftRoot = left.root ?? left.schema;
        const rightRoot = right.root ?? right.schema;
        const seen = new Map<JsonValue, Set<JsonValue>>();
        const dereference = (
            initial: JsonValue,
            root: JsonSchema,
        ): { value: JsonValue; semantic?: JsonValue } | undefined => {
            let value = initial;
            let semantic: JsonValue | undefined;
            for (let count = 0; count < 128; count++) {
                if (!object(value)) return { value, semantic };
                semantic ??= value['x-sapio-type'];
                if (!Object.hasOwn(value, '$ref')) return { value, semantic };
                if (
                    typeof value.$ref !== 'string' ||
                    !value.$ref.startsWith('#')
                )
                    return undefined;
                const pointer = value.$ref.slice(1);
                if (!hasSchemaPointer(root, pointer)) return undefined;
                value = readPointer(root, pointer);
            }
            return undefined;
        };
        const equalData = (
            x: JsonValue | undefined,
            y: JsonValue | undefined,
        ) =>
            x === undefined || y === undefined
                ? x === y
                : canonical(x) === canonical(y);
        const schema = (x: JsonValue, y: JsonValue, depth: number): boolean => {
            if (budget.remaining-- <= 0 || depth > 128) return false;
            const l = dereference(x, leftRoot);
            const r = dereference(y, rightRoot);
            if (!l || !r || !equalData(l.semantic, r.semantic)) return false;
            x = l.value;
            y = r.value;
            if (
                (object(x) && '$id' in x && x !== leftRoot) ||
                (object(y) && '$id' in y && y !== rightRoot)
            )
                return false;
            if (seen.get(x)?.has(y)) return true;
            seen.set(x, (seen.get(x) ?? new Set()).add(y));
            if (!object(x) || !object(y)) return equalData(x, y);
            const keys = (value: JsonObject) =>
                Object.keys(value)
                    .filter(
                        (key) =>
                            !annotations.has(key) &&
                            !['definitions', '$defs', 'x-sapio-type'].includes(
                                key,
                            ),
                    )
                    .sort();
            const lk = keys(x),
                rk = keys(y);
            if (canonical(lk) !== canonical(rk)) return false;
            return lk.every((key) => {
                const l = (x as JsonObject)[key]!,
                    r = (y as JsonObject)[key]!;
                if (
                    [
                        'properties',
                        'patternProperties',
                        'dependencies',
                    ].includes(key)
                ) {
                    if (
                        !object(l) ||
                        !object(r) ||
                        canonical(Object.keys(l).sort()) !==
                            canonical(Object.keys(r).sort())
                    )
                        return false;
                    return Object.keys(l).every((name) =>
                        child(l[name]!, r[name]!, depth + 1),
                    );
                }
                if (
                    [
                        'items',
                        'additionalItems',
                        'additionalProperties',
                        'contains',
                        'propertyNames',
                        'not',
                        'if',
                        'then',
                        'else',
                    ].includes(key)
                )
                    return child(l, r, depth + 1);
                if (['allOf', 'anyOf', 'oneOf'].includes(key))
                    return sequence(l, r, depth + 1);
                if (key === 'x-sapio-module') {
                    if (
                        !object(l) ||
                        !object(r) ||
                        Object.keys(l).length !== 2 ||
                        Object.keys(r).length !== 2
                    )
                        return false;
                    return ['arguments', 'returns'].every((side) => {
                        const a = asSchema(l[side]),
                            b = asSchema(r[side]);
                        return (
                            a !== undefined &&
                            b !== undefined &&
                            compare({ schema: a }, { schema: b }, depth + 1)
                        );
                    });
                }
                if (key === 'required' && Array.isArray(l) && Array.isArray(r))
                    return (
                        l.length === r.length &&
                        l.every((value) =>
                            r.some((other) => equalData(value, other)),
                        )
                    );
                return equalData(l, r);
            });
        };
        const sequence = (x: JsonValue, y: JsonValue, depth: number): boolean =>
            Array.isArray(x) &&
            Array.isArray(y) &&
            x.length === y.length &&
            x.every((value, index) => schema(value, y[index]!, depth));
        const child = (x: JsonValue, y: JsonValue, depth: number): boolean =>
            Array.isArray(x) || Array.isArray(y)
                ? sequence(x, y, depth)
                : schema(x, y, depth);
        return schema(left.schema, right.schema, nesting);
    };
    return compare(a, b, 0);
}

function hasSchemaPointer(root: JsonSchema, pointer: string): boolean {
    if (
        pointer !== '' &&
        (!pointer.startsWith('/') || /~(?:[^01]|$)/u.test(pointer))
    )
        return false;
    // Schema property names are JSON data too; the common pointer helper rejects
    // reserved prototype names consistently with the rest of the editor.
    const tokens =
        pointer === ''
            ? []
            : pointer
                  .slice(1)
                  .split('/')
                  .map((part) =>
                      part.replace(/~1/gu, '/').replace(/~0/gu, '~'),
                  );
    if (
        tokens.some((token) =>
            ['__proto__', 'prototype', 'constructor'].includes(token),
        )
    )
        return false;
    let value: JsonValue = root;
    for (const token of tokens) {
        if (
            (!object(value) && !Array.isArray(value)) ||
            !Object.hasOwn(value, token)
        )
            return false;
        value = (value as JsonObject)[token]!;
    }
    return true;
}

const refinements = new Set([
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'minLength',
    'maxLength',
    'pattern',
    'format',
    'minItems',
    'maxItems',
    'uniqueItems',
]);

function withoutRefinements(value: JsonValue): JsonValue {
    if (!object(value)) return value;
    const maps = new Set([
        'properties',
        'patternProperties',
        'dependentSchemas',
        'dependencies',
    ]);
    const singles = new Set([
        'items',
        'additionalItems',
        'additionalProperties',
        'contains',
        'not',
        'if',
        'then',
        'else',
        'propertyNames',
    ]);
    const lists = new Set(['allOf', 'oneOf', 'anyOf', 'prefixItems']);
    const result: JsonObject = {};
    for (const [key, child] of Object.entries(value)) {
        if (refinements.has(key)) continue;
        if (maps.has(key) && object(child))
            result[key] = Object.fromEntries(
                Object.entries(child).map(([name, schema]) => [
                    name,
                    withoutRefinements(schema),
                ]),
            );
        else if ((lists.has(key) || key === 'items') && Array.isArray(child))
            result[key] = child.map(withoutRefinements);
        else if (singles.has(key)) result[key] = withoutRefinements(child);
        else result[key] = child;
    }
    return result;
}

export function compatibleValues(
    source: SchemaPort,
    target: SchemaPort,
): Compatibility {
    if (source.kind !== target.kind)
        return mismatch(
            'A callable implementation and its result are different sockets. Use the module-reference outlet.',
        );
    if (source.kind === 'module')
        return sameSchema(source, target)
            ? {
                  compatible: true,
                  status: 'exact',
                  reason: 'Matching callable reference value. Its selected module is checked before use.',
              }
            : mismatch(
                  'These callable reference values declare different interfaces.',
              );
    const a = resolveSchema(source.schema, source.root);
    const b = resolveSchema(target.schema, target.root);
    if (
        b === true ||
        (object(b) && Object.keys(b).every((key) => annotations.has(key)))
    ) {
        return {
            compatible: true,
            status: 'exact',
            reason: 'This input accepts any JSON value.',
        };
    }
    if (object(a) && object(b) && a['x-sapio-type'] !== b['x-sapio-type']) {
        return mismatch(
            `${schemaLabel(source)} cannot connect to ${schemaLabel(target)}. Choose a matching type or an explicit adapter.`,
        );
    }
    if (sameSchema(source, target))
        return {
            compatible: true,
            status: 'exact',
            reason: 'Matching type. Actual values are validated before use.',
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
            status: 'exact',
            reason: 'Matching type. Actual values are validated before use.',
        };
    }
    if (
        from !== undefined &&
        to !== undefined &&
        canonical(withoutRefinements(from)) ===
            canonical(withoutRefinements(to))
    ) {
        return {
            compatible: true,
            status: 'checked-at-build',
            reason: 'Matching type with different constraints. The value is checked when built.',
        };
    }
    return mismatch(
        `${schemaLabel(source)} cannot connect to ${schemaLabel(target)}: the declared structures differ. Use an explicit adapter.`,
    );
}

/** Callable interfaces use exact schemas, including the invocation context. */
export function compatibleModule(
    module: ModuleInfo,
    target: SchemaPort,
): Compatibility {
    if (target.kind !== 'module')
        return mismatch('Module references only enter callable input sockets.');
    const resolved = resolveSchema(target.schema, target.root);
    const api = object(resolved) ? resolved['x-sapio-module'] : undefined;
    if (!object(api))
        return mismatch(
            'This callable input does not declare its expected interface.',
        );
    const argumentsSchema = asSchema(api.arguments);
    const returnsSchema = asSchema(api.returns);
    if (argumentsSchema === undefined || returnsSchema === undefined)
        return mismatch(
            'This callable input has an incomplete interface declaration.',
        );
    if (
        !sameSchema(
            { schema: module.api.arguments },
            { schema: argumentsSchema },
        ) ||
        !sameSchema({ schema: module.api.returns }, { schema: returnsSchema })
    )
        return mismatch(
            'This module does not implement the input and output types required by the callable socket.',
        );
    return {
        compatible: true,
        status: 'exact',
        reason: 'Matching callable interface. Its caller supplies the arguments.',
    };
}

/** Domain names do not change when a use site labels the same type “Trigger”. */
export function semanticLabel(identity: string): string {
    const known: Record<string, string> = {
        'bitcoin.x-only-public-key': 'Public key',
        'bitcoin.address': 'Address',
        'bitcoin.xpub': 'Extended public key',
        'bitcoin.satoshis': 'Satoshis',
        'bitcoin.relative-blocks': 'Blocks',
        'sapio.authorization': 'Authorization',
        'sapio.block-delay': 'Block delay',
        'sapio.address-target': 'Destination',
        'sapio.recovery-rule': 'Recovery rule',
        'sapio.release-rule': 'Release rule',
        'sapio.oracle-root': 'Emulation root',
        'sapio.withdrawal-proposal': 'Withdrawal proposal',
        'sapio.compiled-contract': 'Compiled contract',
    };
    return (
        known[identity] ??
        humanize(
            identity
                .replace(/(?:[/:.]v?\d+)$/u, '')
                .split(/[/:.]/u)
                .at(-1)!,
        )
    );
}

export function schemaLabel(
    port: Pick<SchemaPort, 'schema' | 'root' | 'kind'>,
): string {
    if (port.kind === 'module') return 'Callable module';
    const schema = resolveSchema(port.schema, port.root);
    if (!object(schema)) return schema ? 'JSON value' : 'No value';
    const semantic = schema['x-sapio-type'];
    if (typeof semantic === 'string') return semanticLabel(semantic);
    if (typeof schema.title === 'string') return humanize(schema.title);
    if (schema.type === 'object' || object(schema.properties)) return 'Record';
    if (schema.type === 'array') {
        const item = asSchema(schema.items);
        return item === undefined
            ? 'List'
            : `List of ${schemaLabel({ schema: item, root: port.root, kind: 'value' })}`;
    }
    if (typeof schema.type === 'string') return humanize(schema.type);
    if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf))
        return 'Choice';
    return 'JSON value';
}

/** Missing values stay missing. Only declared defaults and constants are seeded. */
export function initialValue(type: ValueType): JsonValue | undefined {
    const root = type.root ?? type.schema;
    const seed = (schema: JsonSchema, depth: number): JsonValue | undefined => {
        const resolved = resolveSchema(schema, root);
        if (!object(resolved) || depth > 8) return undefined;
        if (Object.hasOwn(resolved, 'default'))
            return structuredClone(resolved.default!);
        if (Object.hasOwn(resolved, 'const'))
            return structuredClone(resolved.const!);
        if (object(resolved.properties) || resolved.type === 'object') {
            const result: JsonObject = {};
            if (object(resolved.properties)) {
                for (const [name, value] of Object.entries(
                    resolved.properties,
                )) {
                    const child = asSchema(value);
                    const seeded =
                        child === undefined
                            ? undefined
                            : seed(child, depth + 1);
                    if (seeded !== undefined) result[name] = seeded;
                }
            }
            return depth === 0 || Object.keys(result).length > 0
                ? result
                : undefined;
        }
        return undefined;
    };
    return seed(type.schema, 0);
}

export function initialArguments(module: ModuleInfo): JsonValue | undefined {
    const port = modulePorts(module, 'arguments')[0];
    return port === undefined ? undefined : initialValue(port);
}
