import type { JsonObject, JsonSchema, JsonValue } from '../../shared/studio';
import { object, resolveSchema } from './schema';

export interface ValueSource {
    label: string;
    onNavigate?: () => void;
}

export type ValueSources = Record<string, ValueSource>;

/** A connection owns its exact input and all descendants, never siblings. */
export function valueSourceAt(
    sources: ValueSources,
    path: string,
): { path: string; source: ValueSource } | undefined {
    const owner = Object.keys(sources)
        .filter(
            (candidate) =>
                candidate === path || path.startsWith(`${candidate}/`),
        )
        .sort((a, b) => a.length - b.length)[0];
    return owner === undefined
        ? undefined
        : { path: owner, source: sources[owner]! };
}

export function hasConnectedDescendant(
    sources: ValueSources,
    path: string,
): boolean {
    return Object.keys(sources).some((candidate) =>
        candidate.startsWith(`${path}/`),
    );
}

export function asValueSchema(
    value: JsonValue | undefined,
): JsonSchema | undefined {
    return typeof value === 'boolean' || object(value) ? value : undefined;
}

export function editorSchema(schema: JsonSchema, root: JsonSchema): JsonSchema {
    const resolved = resolveSchema(schema, root);
    if (!object(resolved) || !object(schema)) return resolved;
    const annotations: JsonObject = {};
    for (const key of [
        'title',
        'description',
        'default',
        'x-sapio-type',
        'x-sapio-unit',
        'x-sapio-module',
    ]) {
        if (Object.hasOwn(schema, key)) annotations[key] = schema[key]!;
    }
    return { ...resolved, ...annotations };
}

export function fieldName(name: string): string {
    const words = name
        .replace(/[_-]/gu, ' ')
        .replace(/([a-z])([A-Z])/gu, '$1 $2');
    return words.length ? words[0]!.toUpperCase() + words.slice(1) : 'Value';
}

/** The input is parsed once; an integer is never silently rounded. */
export function parseNumericInput(text: string, integer: boolean): number {
    const parts = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u.exec(
        text,
    );
    if (!parts)
        throw new Error(
            integer ? 'Enter a whole number.' : 'Enter a JSON number.',
        );
    const value = Number(text);
    if (!Number.isFinite(value)) throw new Error('Enter a finite number.');
    if (integer && !Number.isInteger(value))
        throw new Error('Enter a whole number.');
    if (Number.isInteger(value)) {
        if (!Number.isSafeInteger(value))
            throw new Error(
                'Outside the exact integer range (−9007199254740991 to 9007199254740991).',
            );
        // Decimal/exponent notation can round to an apparently safe integer.
        // Compare the original decimal exactly before accepting that integer.
        const fraction = parts[3] ?? '';
        const exponent = Number(parts[4] ?? 0) - fraction.length;
        const coefficient = BigInt(`${parts[1]}${parts[2]}${fraction}`);
        if (coefficient !== 0n) {
            if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) {
                throw new Error('This value loses precision as a JSON number.');
            }
            const exact =
                exponent >= 0
                    ? coefficient * 10n ** BigInt(exponent) === BigInt(value)
                    : coefficient === BigInt(value) * 10n ** BigInt(-exponent);
            if (!exact)
                throw new Error('This value loses precision as a JSON number.');
        }
    }
    return value;
}

export function parseEditorJson(text: string): JsonValue {
    const value = JSON.parse(text) as JsonValue;
    // Inspect tokens outside strings before JavaScript can hide a rounded
    // integer in the parsed object. Identifiers and strings remain opaque.
    const tokens =
        text.match(
            /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/gu,
        ) ?? [];
    for (const token of tokens)
        if (!token.startsWith('"')) parseNumericInput(token, false);
    return value;
}

export function scalarIssue(
    value: JsonValue | undefined,
    schema: JsonSchema,
): string | undefined {
    if (value === undefined || !object(schema)) return undefined;
    if (typeof schema.type === 'string') {
        const actual =
            value === null
                ? 'null'
                : Array.isArray(value)
                  ? 'array'
                  : typeof value;
        if (
            schema.type !== actual &&
            !(schema.type === 'integer' && actual === 'number')
        ) {
            return `Expected ${schema.type === 'integer' ? 'a whole number' : schema.type}.`;
        }
    }
    if (typeof value === 'number') {
        if (
            !Number.isFinite(value) ||
            (Number.isInteger(value) && !Number.isSafeInteger(value))
        )
            return 'This number cannot be represented exactly.';
        if (schema.type === 'integer' && !Number.isInteger(value))
            return 'Enter a whole number.';
        if (typeof schema.minimum === 'number' && value < schema.minimum)
            return `Must be at least ${schema.minimum}.`;
        if (typeof schema.maximum === 'number' && value > schema.maximum)
            return `Must be at most ${schema.maximum}.`;
        if (
            typeof schema.exclusiveMinimum === 'number' &&
            value <= schema.exclusiveMinimum
        )
            return `Must be greater than ${schema.exclusiveMinimum}.`;
        if (
            typeof schema.exclusiveMaximum === 'number' &&
            value >= schema.exclusiveMaximum
        )
            return `Must be less than ${schema.exclusiveMaximum}.`;
    }
    if (typeof value === 'string') {
        const length = [...value].length;
        if (typeof schema.minLength === 'number' && length < schema.minLength)
            return `Enter at least ${schema.minLength} characters.`;
        if (typeof schema.maxLength === 'number' && length > schema.maxLength)
            return `Enter at most ${schema.maxLength} characters.`;
    }
    if (Array.isArray(value)) {
        if (
            typeof schema.minItems === 'number' &&
            value.length < schema.minItems
        )
            return `Add at least ${schema.minItems} items.`;
        if (
            typeof schema.maxItems === 'number' &&
            value.length > schema.maxItems
        )
            return `Use at most ${schema.maxItems} items.`;
    }
    return undefined;
}

export function schemaChoices(schema: JsonSchema): JsonSchema[] {
    if (!object(schema)) return [];
    const union = Array.isArray(schema.oneOf) ? schema.oneOf : schema.anyOf;
    if (Array.isArray(union))
        return union
            .map(asValueSchema)
            .filter((branch) => branch !== undefined);
    if (Array.isArray(schema.type)) {
        return schema.type
            .filter((type) => typeof type === 'string')
            .map((type) => ({ ...schema, type }));
    }
    return [];
}

export function choiceLabel(
    schema: JsonSchema,
    root: JsonSchema,
    index: number,
): string {
    const shape = editorSchema(schema, root);
    if (!object(shape)) return shape ? 'Any value' : 'Unavailable';
    if (typeof shape.title === 'string') return shape.title;
    if (Object.hasOwn(shape, 'const')) return JSON.stringify(shape.const);
    if (Array.isArray(shape.enum) && shape.enum.length === 1)
        return JSON.stringify(shape.enum[0]);
    if (object(shape.properties) && Object.keys(shape.properties).length === 1)
        return fieldName(Object.keys(shape.properties)[0]!);
    return typeof shape.type === 'string'
        ? fieldName(shape.type)
        : `Choice ${index + 1}`;
}

/** Select a display branch only when one shape identifies it unambiguously.
 * Execution still validates the full schema through the runtime worker. */
export function matchingChoice(
    value: JsonValue | undefined,
    choices: JsonSchema[],
    root: JsonSchema,
): number | undefined {
    if (value === undefined) return undefined;
    const matches = choices.flatMap((branch, index) => {
        const shape = editorSchema(branch, root);
        if (!object(shape)) return [];
        if (Object.hasOwn(shape, 'const'))
            return JSON.stringify(value) === JSON.stringify(shape.const)
                ? [index]
                : [];
        if (Array.isArray(shape.enum))
            return shape.enum.some(
                (entry) => JSON.stringify(value) === JSON.stringify(entry),
            )
                ? [index]
                : [];
        if (object(value) && object(shape.properties)) {
            const properties = shape.properties;
            if (
                Array.isArray(shape.required) &&
                shape.required.some(
                    (name) =>
                        typeof name === 'string' && !Object.hasOwn(value, name),
                )
            )
                return [];
            if (
                Object.keys(value).some(
                    (name) => !Object.hasOwn(properties, name),
                ) &&
                shape.additionalProperties === false
            )
                return [];
            for (const [name, child] of Object.entries(properties)) {
                const childSchema = asValueSchema(child);
                const childShape =
                    childSchema === undefined
                        ? undefined
                        : editorSchema(childSchema, root);
                if (
                    object(childShape) &&
                    Object.hasOwn(childShape, 'const') &&
                    JSON.stringify(value[name]) !==
                        JSON.stringify(childShape.const)
                )
                    return [];
            }
            return Object.keys(value).some((name) =>
                Object.hasOwn(properties, name),
            )
                ? [index]
                : [];
        }
        const type =
            value === null
                ? 'null'
                : Array.isArray(value)
                  ? 'array'
                  : typeof value;
        return shape.type === type ||
            (shape.type === 'integer' &&
                typeof value === 'number' &&
                Number.isInteger(value))
            ? [index]
            : [];
    });
    return matches.length === 1 ? matches[0] : undefined;
}

export function selectedChoiceValue(
    schema: JsonSchema,
    root: JsonSchema,
): JsonValue | undefined {
    const shape = editorSchema(schema, root);
    if (!object(shape)) return undefined;
    if (Object.hasOwn(shape, 'const')) return structuredClone(shape.const!);
    if (Array.isArray(shape.enum) && shape.enum.length === 1)
        return structuredClone(shape.enum[0]!);
    if (shape.type === 'null') return null;
    // Selecting a tagged variant supplies its actual discriminator, not guessed
    // payload values or an implicit first enum case.
    if (object(shape.properties)) {
        const value: JsonObject = {};
        for (const [name, child] of Object.entries(shape.properties)) {
            const childSchema = asValueSchema(child);
            const childShape =
                childSchema === undefined
                    ? undefined
                    : editorSchema(childSchema, root);
            if (object(childShape) && Object.hasOwn(childShape, 'const'))
                value[name] = structuredClone(childShape.const!);
        }
        if (Object.keys(value).length) return value;
    }
    return undefined;
}

export function replaceObjectField(
    value: JsonValue | undefined,
    name: string,
    replacement: JsonValue | undefined,
): JsonObject {
    const result: JsonObject = object(value) ? { ...value } : {};
    if (replacement === undefined) delete result[name];
    else
        Object.defineProperty(result, name, {
            value: replacement,
            enumerable: true,
            writable: true,
            configurable: true,
        });
    return result;
}
