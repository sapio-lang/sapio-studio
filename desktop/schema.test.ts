// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { validateValue as validateInWorker } from './schema';
import { validateSchema } from './schema-validation';
import type { JsonSchema, JsonValue } from '../shared/studio';
import { MAX_DOCUMENT_BYTES } from './cli';

const worker = path.resolve('dist/desktop/schema-worker.cjs');
const validateValue = (schema: JsonSchema, value: JsonValue) =>
    validateInWorker(schema, value, worker);

describe('module API validation', () => {
    it('recognizes Rust integer annotations while retaining numeric and other format checks', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const byte = {
                type: 'integer',
                format: 'uint8',
                minimum: 0,
                maximum: 255,
            };
            expect(validateSchema(byte, 255).valid).toBe(true);
            for (const value of [-1, 256, 1.5, '1'])
                expect(validateSchema(byte, value).valid).toBe(false);
            const amount = {
                type: 'integer',
                format: 'uint64',
                minimum: 1,
                maximum: 2_100_000_000_000_000,
            };
            expect(validateSchema(amount, 2_100_000_000_000_000).valid).toBe(
                true,
            );
            expect(validateSchema(amount, 2_100_000_000_000_001).valid).toBe(
                false,
            );
            expect(
                validateSchema({ type: 'string', format: 'email' }, 'invalid')
                    .valid,
            ).toBe(false);
            expect(warn).not.toHaveBeenCalled();
            validateSchema(
                { type: 'string', format: 'unconfigured-custom-format' },
                'value',
            );
            expect(warn).toHaveBeenCalledWith(
                expect.stringContaining('unconfigured-custom-format'),
            );
        } finally {
            warn.mockRestore();
        }
    });
    it('validates current schemars definitions in workers without mutating documents', async () => {
        const schema = {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: { sats: { $ref: '#/$defs/Amount' } },
            required: ['sats'],
            additionalProperties: false,
            $defs: { Amount: { type: 'integer', minimum: 1 } },
        };
        expect(await validateValue(schema, { sats: 1000 })).toEqual({
            valid: true,
            errors: [],
        });
        expect((await validateValue(schema, { sats: 0 })).valid).toBe(false);
        expect(
            (await validateValue(schema, { sats: 1, unexpected: true })).valid,
        ).toBe(false);
        const input = { sats: '1000' };
        expect((await validateValue(schema, input)).valid).toBe(false);
        expect(input).toEqual({ sats: '1000' });
    });
    it('supports draft seven module schemas and refuses unresolved remote schemas', async () => {
        expect(
            (
                await validateValue(
                    {
                        $schema: 'http://json-schema.org/draft-07/schema#',
                        type: 'string',
                    },
                    'value',
                )
            ).valid,
        ).toBe(true);
        await expect(
            validateValue(
                { $ref: 'https://unconfigured.invalid/schema.json' },
                {},
            ),
        ).rejects.toThrow('Module schema validation failed');
    });
    it('rejects oversized documents and reports unavailable worker assets', async () => {
        await expect(
            validateValue(true, 'x'.repeat(MAX_DOCUMENT_BYTES)),
        ).rejects.toThrow('32 MiB validation limit');
        await expect(
            validateInWorker(
                true,
                null,
                path.resolve('dist/desktop/missing-schema-worker.cjs'),
            ),
        ).rejects.toThrow('Schema validation worker failed');
    });
});
