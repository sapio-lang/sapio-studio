import { useEffect, useRef, useState } from 'react';
import { Play, SearchCheck } from 'lucide-react';
import type { JsonValue, ModuleInfo, StudioAPI } from '../shared/studio';
import { JsonDetails, Spinner, errorMessage } from './ui';
import { assertJsonNumbers } from './patching/engine';
import { initialArguments, modulePorts } from './patching/schema';
import { SchemaValueEditor } from './patching/SchemaValueEditor';
import { displayModuleName } from './patching/PatchNodeCard';
import { parseEditorJson } from './patching/schemaValue';
import type { CompilationSource } from './compilationSource';

export function ModuleAuthoring({
    module,
    context,
    api,
    onInspect,
}: {
    module: ModuleInfo;
    context: JsonValue;
    api?: StudioAPI;
    onInspect: (
        artifact: string,
        name: string,
        source: CompilationSource,
    ) => Promise<void>;
}) {
    const input = modulePorts(module, 'arguments')[0];
    const name = displayModuleName(module);
    const [argumentsValue, setArgumentsValue] = useState<JsonValue | undefined>(
        () => initialArguments(module),
    );
    const [result, setResult] = useState('');
    const [source, setSource] = useState<CompilationSource | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [invalid, setInvalid] = useState<Set<string>>(new Set());
    const revision = useRef(0);
    const mounted = useRef(true);
    useEffect(() => {
        revision.current++;
        setResult('');
        setSource(null);
        setError('');
    }, [context]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            revision.current++;
        };
    }, []);
    function edit(value: JsonValue | undefined) {
        revision.current++;
        setArgumentsValue(value);
        setResult('');
        setSource(null);
        setError('');
    }
    async function run() {
        if (!api || busy || invalid.size) return;
        const currentRevision = ++revision.current;
        const current = () =>
            mounted.current && revision.current === currentRevision;
        setBusy(true);
        setError('');
        setResult('');
        try {
            if (argumentsValue === undefined)
                throw new Error('Supply the module inputs before running.');
            const args: JsonValue = structuredClone({
                arguments: argumentsValue,
                context,
            });
            assertJsonNumbers(args, 'Module arguments');
            const validation = await api.modules.validate({
                key: module.key,
                side: 'arguments',
                value: args,
            });
            if (!current()) return;
            if (!validation.valid)
                throw new Error(validation.errors.join('\n'));
            const output = await api.modules.call({
                key: module.key,
                args: JSON.stringify(args),
            });
            if (!current()) return;
            const value = parseEditorJson(output);
            assertJsonNumbers(value, 'Module result');
            const checked = await api.modules.validate({
                key: module.key,
                side: 'returns',
                value,
            });
            if (!current()) return;
            if (!checked.valid)
                throw new Error(
                    `Module result does not match its return schema:\n${checked.errors.join('\n')}`,
                );
            setResult(output);
            setSource({ kind: 'module', key: module.key, args, result: value });
        } catch (error) {
            if (current()) setError(errorMessage(error));
        } finally {
            if (mounted.current) setBusy(false);
        }
    }
    return (
        <div className="module-authoring">
            <div className="section-overline">Module input</div>
            <h2>{name}</h2>
            <p className="muted">
                {module.description ||
                    'Supply typed inputs, then run the module in the configured Sapio host.'}
            </p>
            {input ? (
                <fieldset className="module-value-fields" disabled={busy}>
                    <SchemaValueEditor
                        schema={input.schema}
                        rootSchema={input.root}
                        value={argumentsValue}
                        onChange={edit}
                        label="Inputs"
                        required
                        onValidityChange={(_, valid, editorId) =>
                            setInvalid((previous) => {
                                const next = new Set(previous);
                                if (valid) next.delete(editorId);
                                else next.add(editorId);
                                return next;
                            })
                        }
                    />
                </fieldset>
            ) : (
                <p role="alert">
                    This module does not publish an editable input interface.
                </p>
            )}
            <JsonDetails title="Compilation context" value={context} />
            <JsonDetails title="Input schema" value={module.api.arguments} />
            <div className="button-row">
                <button
                    className="button primary"
                    disabled={
                        !api ||
                        busy ||
                        !input ||
                        invalid.size > 0 ||
                        argumentsValue === undefined
                    }
                    onClick={() => void run()}
                >
                    <Play size={15} />
                    Run module
                </button>
                {busy && <Spinner label="Running module" />}
            </div>
            {invalid.size > 0 && (
                <p className="help-text" role="status">
                    Finish the invalid field before running.
                </p>
            )}
            {error && (
                <pre className="error-message" role="alert">
                    {error}
                </pre>
            )}
            {result && source && (
                <div className="module-result">
                    <h3>Module result</h3>
                    <pre>{result}</pre>
                    <div className="button-row">
                        <button
                            className="button"
                            disabled={busy}
                            onClick={async () => {
                                const currentRevision = revision.current;
                                setBusy(true);
                                try {
                                    await onInspect(result, name, source);
                                } catch (error) {
                                    if (
                                        mounted.current &&
                                        revision.current === currentRevision
                                    )
                                        setError(errorMessage(error));
                                } finally {
                                    if (mounted.current) setBusy(false);
                                }
                            }}
                        >
                            <SearchCheck size={15} />
                            Inspect as contract
                        </button>
                        <button
                            className="button subtle"
                            disabled={busy}
                            onClick={async () => {
                                const currentRevision = revision.current;
                                try {
                                    await api?.documents.save({
                                        name: `${module.name}.json`,
                                        text: result,
                                        kind: 'json',
                                    });
                                } catch (error) {
                                    if (
                                        mounted.current &&
                                        revision.current === currentRevision
                                    )
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
