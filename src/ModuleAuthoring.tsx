import { useState } from 'react';
import { Braces, Play, SearchCheck } from 'lucide-react';
import type {
    JsonObject,
    JsonSchema,
    JsonValue,
    ModuleInfo,
    StudioAPI,
} from '../shared/studio';
import { DocumentField, JsonDetails, Spinner, errorMessage } from './ui';
import { assertJsonNumbers } from './patching/engine';

function object(
    value: JsonValue | JsonSchema | undefined,
): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function resolve(
    schema: JsonSchema,
    root: JsonSchema,
    seen = new Set<string>(),
): JsonSchema {
    if (!object(schema)) return schema;
    if (Array.isArray(schema.allOf) && schema.allOf.length === 1) {
        const inner = schema.allOf[0];
        if (typeof inner === 'boolean' || object(inner)) {
            const resolved = resolve(inner, root, seen);
            if (object(resolved)) {
                const { allOf: _, ...annotations } = schema;
                return { ...resolved, ...annotations };
            }
        }
    }
    if (
        typeof schema.$ref !== 'string' ||
        !schema.$ref.startsWith('#/') ||
        seen.has(schema.$ref)
    )
        return schema;
    seen.add(schema.$ref);
    let current: JsonValue | JsonSchema | undefined = root;
    for (const part of schema.$ref.slice(2).split('/'))
        current = object(current)
            ? current[part.replace(/~1/g, '/').replace(/~0/g, '~')]
            : undefined;
    return typeof current === 'boolean' || object(current)
        ? resolve(current, root, seen)
        : schema;
}

/** Editing aids only. The desktop process validates the complete schema. */
function primitiveProperties(
    schema: JsonSchema,
): Record<string, JsonObject> | null {
    const root = resolve(schema, schema);
    if (!object(root) || !object(root.properties)) return null;
    const args = root.properties.arguments;
    const input =
        typeof args === 'boolean' || object(args)
            ? resolve(args, schema)
            : null;
    if (!object(input) || !object(input.properties)) return null;
    const result: Record<string, JsonObject> = {};
    for (const [name, value] of Object.entries(input.properties)) {
        if (typeof value !== 'boolean' && !object(value)) return null;
        const field = resolve(value, schema);
        if (
            !object(field) ||
            !['string', 'integer', 'number', 'boolean'].includes(
                String(field.type),
            )
        )
            return null;
        result[name] = field;
    }
    return Object.keys(result).length ? result : null;
}

export function ModuleAuthoring({
    module,
    context,
    api,
    onInspect,
}: {
    module: ModuleInfo;
    context: JsonValue;
    api?: StudioAPI;
    onInspect: (artifact: string, name: string) => Promise<void>;
}) {
    const fields = primitiveProperties(module.api.arguments);
    const [mode, setMode] = useState<'fields' | 'json'>(
        fields ? 'fields' : 'json',
    );
    const [argumentsText, setArgumentsTextRaw] = useState('{}');
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    function setArgumentsText(text: string) {
        setArgumentsTextRaw(text);
        setResult('');
        setError('');
    }
    let values: JsonObject = {};
    try {
        const parsed: JsonValue = JSON.parse(argumentsText);
        if (object(parsed)) values = parsed;
    } catch {
        /* Raw editing may be incomplete; validation runs on submit. */
    }
    async function run() {
        if (!api) return;
        setBusy(true);
        setError('');
        setResult('');
        try {
            const args: JsonValue = {
                arguments: JSON.parse(argumentsText),
                context,
            };
            assertJsonNumbers(args, 'Module arguments');
            const validation = await api.modules.validate({
                key: module.key,
                side: 'arguments',
                value: args,
            });
            if (!validation.valid)
                throw new Error(validation.errors.join('\n'));
            const output = await api.modules.call({
                key: module.key,
                args: JSON.stringify(args),
            });
            const checked = await api.modules.validate({
                key: module.key,
                side: 'returns',
                value: JSON.parse(output),
            });
            if (!checked.valid)
                throw new Error(
                    `Module result does not match its return schema:\n${checked.errors.join('\n')}`,
                );
            setResult(output);
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }
    return (
        <div className="module-authoring">
            <div className="section-overline">Module input</div>
            <h2>{module.name}</h2>
            <p className="muted">
                {module.description ||
                    'Supply arguments, then run the module in the configured Sapio host.'}
            </p>
            {fields && (
                <div className="segmented-control" aria-label="Input editor">
                    <button
                        className={mode === 'fields' ? 'active' : ''}
                        disabled={busy}
                        onClick={() => setMode('fields')}
                    >
                        Fields
                    </button>
                    <button
                        className={mode === 'json' ? 'active' : ''}
                        disabled={busy}
                        onClick={() => setMode('json')}
                    >
                        <Braces size={13} /> JSON
                    </button>
                </div>
            )}
            {mode === 'fields' && fields ? (
                <div className="schema-fields">
                    {Object.entries(fields).map(([name, schema]) => (
                        <label key={name}>
                            {typeof schema.title === 'string'
                                ? schema.title
                                : name}
                            {schema.type === 'boolean' ? (
                                <select
                                    disabled={busy}
                                    value={
                                        values[name] === undefined
                                            ? ''
                                            : String(values[name])
                                    }
                                    onChange={(event) =>
                                        setArgumentsText(
                                            JSON.stringify(
                                                {
                                                    ...values,
                                                    [name]:
                                                        event.target.value ===
                                                        'true',
                                                },
                                                null,
                                                2,
                                            ),
                                        )
                                    }
                                >
                                    <option value="" disabled>
                                        Choose…
                                    </option>
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                </select>
                            ) : Array.isArray(schema.enum) ? (
                                <select
                                    disabled={busy}
                                    value={
                                        values[name] === undefined
                                            ? ''
                                            : String(values[name])
                                    }
                                    onChange={(event) =>
                                        setArgumentsText(
                                            JSON.stringify(
                                                {
                                                    ...values,
                                                    [name]:
                                                        schema.type === 'string'
                                                            ? event.target.value
                                                            : Number(
                                                                  event.target
                                                                      .value,
                                                              ),
                                                },
                                                null,
                                                2,
                                            ),
                                        )
                                    }
                                >
                                    <option value="" disabled>
                                        Choose…
                                    </option>
                                    {schema.enum.map((value) => (
                                        <option
                                            key={String(value)}
                                            value={String(value)}
                                        >
                                            {String(value)}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    disabled={busy}
                                    type={
                                        schema.type === 'string'
                                            ? 'text'
                                            : 'number'
                                    }
                                    step={schema.type === 'integer' ? 1 : 'any'}
                                    value={String(values[name] ?? '')}
                                    onChange={(event) => {
                                        const next = { ...values };
                                        if (event.target.value === '')
                                            delete next[name];
                                        else
                                            next[name] =
                                                schema.type === 'string'
                                                    ? event.target.value
                                                    : Number(
                                                          event.target.value,
                                                      );
                                        setArgumentsText(
                                            JSON.stringify(next, null, 2),
                                        );
                                    }}
                                />
                            )}
                            {typeof schema.description === 'string' && (
                                <small>{schema.description}</small>
                            )}
                        </label>
                    ))}
                </div>
            ) : (
                <DocumentField
                    label="Arguments JSON"
                    value={argumentsText}
                    onChange={setArgumentsText}
                    api={api}
                    rows={9}
                    disabled={busy}
                />
            )}
            <JsonDetails title="Compilation context" value={context} />
            <JsonDetails title="Input schema" value={module.api.arguments} />
            <div className="button-row">
                <button
                    className="button primary"
                    disabled={!api || busy}
                    onClick={run}
                >
                    <Play size={15} />
                    Run module
                </button>
                {busy && <Spinner label="Running module" />}
            </div>
            {error && (
                <pre className="error-message" role="alert">
                    {error}
                </pre>
            )}
            {result && (
                <div className="module-result">
                    <h3>Module result</h3>
                    <pre>{result}</pre>
                    <div className="button-row">
                        <button
                            className="button"
                            disabled={busy}
                            onClick={async () => {
                                setBusy(true);
                                try {
                                    await onInspect(result, module.name);
                                } catch (error) {
                                    setError(errorMessage(error));
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            <SearchCheck size={15} />
                            Inspect as contract
                        </button>
                        <button
                            className="button subtle"
                            onClick={async () => {
                                try {
                                    await api?.documents.save({
                                        name: `${module.name}.json`,
                                        text: result,
                                        kind: 'json',
                                    });
                                } catch (error) {
                                    setError(errorMessage(error));
                                }
                            }}
                        >
                            Export result
                        </button>
                    </div>
                    <p className="help-text">
                        Modules can return any JSON value. Contract inspection
                        validates results that are compiled artifacts.
                    </p>
                </div>
            )}
        </div>
    );
}
