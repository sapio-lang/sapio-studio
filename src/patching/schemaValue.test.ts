import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '../../shared/studio';
import { SchemaValueEditor } from './SchemaValueEditor';
import {
    editorSchema,
    hasConnectedDescendant,
    matchingChoice,
    parseEditorJson,
    parseNumericInput,
    replaceObjectField,
    scalarIssue,
    schemaChoices,
    selectedChoiceValue,
    valueSourceAt,
} from './schemaValue';

describe('typed input ownership', () => {
    it('offers extraction at declared sockets, without inventing array-item sockets', () => {
        const html = renderToStaticMarkup(
            createElement(SchemaValueEditor, {
                schema: { type: 'array', items: { type: 'integer' } },
                value: [144, 288],
                onChange: () => {},
                onExtract: () => {},
            }),
        );
        expect(html.match(/>Extract variable</gu)).toHaveLength(1);
    });
    const sources = {
        '/release': { label: 'Withdrawal rule' },
        '/fee': { label: 'Fee budget' },
    };
    it('locks a connected record and its descendants while preserving siblings', () => {
        expect(valueSourceAt(sources, '/release')?.source.label).toBe(
            'Withdrawal rule',
        );
        expect(valueSourceAt(sources, '/release/delay')?.source.label).toBe(
            'Withdrawal rule',
        );
        expect(valueSourceAt(sources, '/release_window')).toBeUndefined();
        expect(valueSourceAt(sources, '/recovery')).toBeUndefined();
        expect(hasConnectedDescendant(sources, '')).toBe(true);
        expect(hasConnectedDescendant(sources, '/release')).toBe(false);
        expect(
            valueSourceAt({ '': { label: 'Whole input' } }, '/anything')?.source
                .label,
        ).toBe('Whole input');
    });

    it('shows a record provider without exposing its shadowed literal fields', () => {
        const schema: JsonSchema = {
            type: 'object',
            properties: {
                release: {
                    type: 'object',
                    properties: { hidden_destination: { type: 'string' } },
                },
                fee: { type: 'integer' },
            },
        };
        const html = renderToStaticMarkup(
            createElement(SchemaValueEditor, {
                schema,
                value: { release: { hidden_destination: 'unused' }, fee: 500 },
                sources: { '/release': { label: 'Withdrawal rule' } },
                onChange: () => {},
            }),
        );
        expect(html).toContain('Connected to');
        expect(html).toContain('Withdrawal rule');
        expect(html).not.toContain('Hidden destination');
        expect(html).not.toContain('unused');
        expect(html).toContain('value="500"');
        // Editing parent JSON would overwrite a descendant connection.
        expect(html).not.toContain('Advanced JSON');
    });

    it('renders callable interfaces as slots instead of locator forms', () => {
        const html = renderToStaticMarkup(
            createElement(SchemaValueEditor, {
                schema: {
                    type: 'object',
                    'x-sapio-module': {
                        arguments: { type: 'string' },
                        returns: { type: 'integer' },
                    },
                    properties: { which_plugin: { type: 'string' } },
                },
                onChange: () => {},
            }),
        );
        expect(html).toContain('calling module supplies its arguments');
        expect(html).not.toContain('Which plugin');
        expect(html).not.toContain('Advanced JSON');
    });
});

describe('exact numeric editing', () => {
    it('preserves accepted integers including exponent notation', () => {
        for (const [text, number] of [
            ['144', 144],
            ['1.44e2', 144],
            ['9007199254740991', Number.MAX_SAFE_INTEGER],
            ['-9007199254740991', Number.MIN_SAFE_INTEGER],
            ['0e100000', 0],
        ] as const) {
            expect(parseNumericInput(text, true)).toBe(number);
        }
        expect(parseNumericInput('0.25', false)).toBe(0.25);
    });

    it('rejects large integers and decimal spellings that round to integers', () => {
        for (const text of [
            '9007199254740992',
            '9007199254740993',
            '9007199254740991.1',
            '1.00000000000000001',
            '1e-9999',
        ]) {
            expect(() => parseNumericInput(text, true)).toThrow(
                /exact integer range|loses precision/u,
            );
            expect(() => parseNumericInput(text, false)).toThrow(
                /exact integer range|loses precision/u,
            );
        }
    });

    it('does not coerce non-JSON numbers or fractions into integers', () => {
        for (const text of [
            '',
            ' 144',
            '+144',
            '0x90',
            '01',
            'NaN',
            'Infinity',
        ])
            expect(() => parseNumericInput(text, true)).toThrow();
        expect(() => parseNumericInput('1e9999', false)).toThrow(/finite/u);
        expect(() => parseNumericInput('144.5', true)).toThrow(/whole number/u);
    });

    it('localizes common range and Unicode length errors', () => {
        expect(scalarIssue(143, { type: 'integer', minimum: 144 })).toBe(
            'Must be at least 144.',
        );
        expect(scalarIssue(145, { type: 'integer', maximum: 144 })).toBe(
            'Must be at most 144.',
        );
        expect(scalarIssue('🔐', { type: 'string', minLength: 2 })).toBe(
            'Enter at least 2 characters.',
        );
        expect(scalarIssue([], { type: 'array', minItems: 2 })).toBe(
            'Add at least 2 items.',
        );
    });

    it('applies exact number parsing to advanced JSON while preserving strings', () => {
        expect(
            parseEditorJson(
                '{"keys":["9007199254740993","quoted\\\"123"],"delay":144}',
            ),
        ).toEqual({ keys: ['9007199254740993', 'quoted"123'], delay: 144 });
        expect(() => parseEditorJson('{"items":[1,9007199254740993]}')).toThrow(
            /exact integer range/u,
        );
        expect(() => parseEditorJson('{"value":1.00000000000000001}')).toThrow(
            /loses precision/u,
        );
        expect(() => parseEditorJson('{invalid')).toThrow(SyntaxError);
    });
});

describe('explicit values and variants', () => {
    it('keeps a named record field distinct from its referenced type title', () => {
        const html = renderToStaticMarkup(
            createElement(SchemaValueEditor, {
                schema: {
                    type: 'object',
                    properties: { waiting_period: { $ref: '#/$defs/Number' } },
                    $defs: {
                        Number: { type: 'integer', title: 'Whole number' },
                    },
                },
                onChange: () => {},
            }),
        );
        expect(html).toContain('>Waiting period</label>');
        expect(html).toContain('>Whole number</span>');
    });
    it('leaves scalar and enum fields unset until the user supplies a value', () => {
        const html = renderToStaticMarkup(
            createElement(SchemaValueEditor, {
                schema: {
                    type: 'object',
                    properties: {
                        amount: { type: 'integer', default: 500 },
                        network: {
                            type: 'string',
                            enum: ['Regtest', 'Bitcoin'],
                        },
                    },
                    required: ['amount', 'network'],
                },
                onChange: () => {},
            }),
        );
        expect(html).toContain('Use default: 500');
        expect(html).not.toContain('value="500"');
        expect(html).toContain('Choose a value…');
        expect(html).not.toContain('value="0" selected');
        expect(html).toContain('Required value is not set.');
    });

    it('distinguishes null from a missing property without disturbing siblings', () => {
        expect(
            replaceObjectField({ destination: 'a', note: 'b' }, 'note', null),
        ).toEqual({ destination: 'a', note: null });
        expect(
            replaceObjectField(
                { destination: 'a', note: null },
                'note',
                undefined,
            ),
        ).toEqual({ destination: 'a' });
        expect(replaceObjectField(undefined, 'delay', 144)).toEqual({
            delay: 144,
        });
    });

    it('selects actual enum discriminators without guessing required payloads', () => {
        const schema: JsonSchema = {
            oneOf: [
                {
                    type: 'object',
                    properties: {
                        kind: { const: 'hot' },
                        key: { type: 'string' },
                    },
                    required: ['kind', 'key'],
                    additionalProperties: false,
                },
                {
                    type: 'object',
                    properties: {
                        kind: { const: 'cold' },
                        keys: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['kind', 'keys'],
                    additionalProperties: false,
                },
                { type: 'null' },
            ],
        };
        const choices = schemaChoices(schema);
        expect(matchingChoice(undefined, choices, schema)).toBeUndefined();
        expect(matchingChoice({ kind: 'hot', key: 'k' }, choices, schema)).toBe(
            0,
        );
        expect(
            matchingChoice({ kind: 'cold', keys: ['k'] }, choices, schema),
        ).toBe(1);
        expect(matchingChoice(null, choices, schema)).toBe(2);
        expect(selectedChoiceValue(choices[0]!, schema)).toEqual({
            kind: 'hot',
        });
        expect(
            selectedChoiceValue({ type: 'integer', minimum: 1 }, schema),
        ).toBeUndefined();
        expect(
            selectedChoiceValue({ enum: ['a', 'b'] }, schema),
        ).toBeUndefined();
        expect(selectedChoiceValue(choices[2]!, schema)).toBeNull();
    });

    it('recognizes externally tagged list and record payloads', () => {
        const schema: JsonSchema = {
            oneOf: [
                {
                    type: 'object',
                    properties: {
                        Many: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['Many'],
                    additionalProperties: false,
                },
                {
                    type: 'object',
                    properties: { One: { type: 'string' } },
                    required: ['One'],
                    additionalProperties: false,
                },
            ],
        };
        const choices = schemaChoices(schema);
        expect(
            matchingChoice({ Many: ['first', 'second'] }, choices, schema),
        ).toBe(0);
        expect(matchingChoice({ One: 'first' }, choices, schema)).toBe(1);
        expect(
            matchingChoice({ Many: [], One: 'first' }, choices, schema),
        ).toBeUndefined();
    });

    it('retains input-specific labels and units while resolving shared types', () => {
        const root: JsonSchema = {
            definitions: {
                Delay: {
                    type: 'integer',
                    minimum: 1,
                    'x-sapio-type': 'sapio:delay',
                },
            },
        };
        expect(
            editorSchema(
                {
                    $ref: '#/definitions/Delay',
                    title: 'Waiting period',
                    'x-sapio-unit': 'blocks',
                },
                root,
            ),
        ).toMatchObject({
            type: 'integer',
            minimum: 1,
            title: 'Waiting period',
            'x-sapio-unit': 'blocks',
            'x-sapio-type': 'sapio:delay',
        });
    });
});
