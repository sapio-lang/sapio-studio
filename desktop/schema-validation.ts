import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { JsonSchema, JsonValue } from '../shared/studio';

/** Invoked only inside the disposable validation worker. */
export function validateSchema(
    schema: JsonSchema,
    value: JsonValue,
): { valid: boolean; errors: string[] } {
    const dialect = typeof schema === 'object' ? schema.$schema : undefined;
    const Constructor =
        typeof dialect === 'string' && dialect.includes('2020-12')
            ? Ajv2020
            : Ajv;
    const ajv = new Constructor({
        strict: false,
        allErrors: false,
        validateFormats: true,
    });
    addFormats(ajv);
    // Schemars describes Rust integer widths with format annotations. Keep
    // its type/minimum/maximum assertions authoritative; uint64/uint128 do
    // not imply that JavaScript can represent every integer at those widths.
    // Existing ajv-formats assertions (including int32/int64) stay enabled.
    for (const format of [
        'uint8',
        'uint16',
        'uint32',
        'uint64',
        'uint128',
        'int8',
        'int16',
        'int128',
    ]) {
        ajv.addFormat(format, true);
    }
    const validate = ajv.compile(schema);
    const valid = validate(value) as boolean;
    return {
        valid,
        errors: (validate.errors ?? []).map(
            (error) =>
                `${error.instancePath || '/'} ${error.message ?? 'does not match the schema'}`,
        ),
    };
}
