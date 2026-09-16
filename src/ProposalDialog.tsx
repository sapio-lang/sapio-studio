import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type {
    JsonValue,
    ModuleInfo,
    ObjectExplanation,
    StudioAPI,
} from '../shared/studio';
import {
    applyProposal,
    findActionOrigins,
    runCompilation,
    sameJsonValue,
    type CompilationSource,
} from './compilationSource';
import { initialValue, object, resolveSchema } from './patching/schema';
import { SchemaValueEditor } from './patching/SchemaValueEditor';
import { JsonDetails, Spinner, errorMessage } from './ui';

export function ProposalDialog({
    source,
    artifact,
    contract,
    action,
    occurrences,
    modules,
    api,
    onGenerated,
}: {
    source: CompilationSource;
    artifact: string;
    contract: string;
    action: ObjectExplanation['actions'][number];
    occurrences: number;
    modules: ModuleInfo[];
    api: StudioAPI;
    onGenerated: (text: string, source: CompilationSource) => Promise<void>;
}) {
    const schema = action.schema!;
    const requestShape = resolveSchema(schema, schema);
    const unitRequest = object(requestShape) && requestShape.type === 'null';
    const actionPath = typeof action.path === 'string' ? action.path : null;
    const origins = useMemo(
        () =>
            actionPath === null
                ? []
                : findActionOrigins(source, contract, actionPath),
        [source, contract, actionPath],
    );
    const [origin, setOrigin] = useState(
        origins.length === 1 ? origins[0]!.id : '',
    );
    const [value, setValue] = useState<JsonValue | undefined>(() =>
        unitRequest ? null : initialValue({ schema, root: schema }),
    );
    const [invalid, setInvalid] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    async function generate() {
        if (
            busy ||
            !origin ||
            value === undefined ||
            invalid.size ||
            actionPath === null
        )
            return;
        setBusy(true);
        setError('');
        try {
            const validation = await api.modules.validateValue({
                schema,
                value,
            });
            if (!mounted.current) return;
            if (!validation.valid)
                throw new Error(validation.errors.join('\n'));
            const next = applyProposal(source, origin, actionPath, value);
            const rebuilt = await runCompilation(next, api, modules);
            if (!mounted.current) return;
            if (
                sameJsonValue(
                    JSON.parse(rebuilt.text) as JsonValue,
                    JSON.parse(artifact) as JsonValue,
                )
            ) {
                throw new Error(
                    'This request produced no change to the contract. The selected compilation step may pass through an existing contract, or the action may have no new proposals for these inputs.',
                );
            }
            await onGenerated(rebuilt.text, rebuilt.source);
        } catch (error) {
            if (mounted.current) setError(errorMessage(error));
        } finally {
            if (mounted.current) setBusy(false);
        }
    }
    return (
        <div className="proposal-editor">
            <h2>Generate a transaction proposal</h2>
            <p className="muted">
                Supply this action’s request, then rebuild the saved
                compilation. The resulting graph must be bound again before
                reviewing a spend.
            </p>
            <code className="outpoint-block">{String(action.path)}</code>
            {occurrences > 1 && (
                <p className="notice">
                    This action path appears in {occurrences} graph occurrences.
                    A request addresses the shared path within the selected
                    compilation step.
                </p>
            )}
            {origins.length > 1 && (
                <label>
                    Compilation step
                    <select
                        disabled={busy}
                        value={origin}
                        onChange={(event) => setOrigin(event.target.value)}
                    >
                        <option value="">
                            Choose the step that creates this contract
                        </option>
                        {origins.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                                {modules.find(
                                    (module) =>
                                        module.key === candidate.moduleKey,
                                )?.name ?? candidate.moduleKey.slice(0, 12)}
                                {candidate.nodePath
                                    ? ` · ${candidate.nodePath.join(' / ')}`
                                    : ''}
                            </option>
                        ))}
                    </select>
                    <span className="help-text">
                        These steps returned this contract. Choose its builder;
                        a step that only passes it through cannot service the
                        action.
                    </span>
                </label>
            )}
            {origins.length === 0 && (
                <p className="notice">
                    The saved compilation has no matching source for this
                    contract output. Open its original builder to generate this
                    proposal.
                </p>
            )}
            {unitRequest ? (
                <p className="notice">
                    This action takes no request parameters.
                </p>
            ) : (
                <fieldset className="module-value-fields" disabled={busy}>
                    <SchemaValueEditor
                        schema={schema}
                        rootSchema={schema}
                        value={value}
                        onChange={setValue}
                        label="Action request"
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
            )}
            <JsonDetails title="Request schema" value={schema} />
            <button
                className="button primary"
                disabled={
                    busy || !origin || value === undefined || invalid.size > 0
                }
                onClick={() => void generate()}
            >
                Generate proposal <ArrowRight size={14} />
            </button>
            {busy && <Spinner label="Rebuilding saved compilation" />}
            {error && (
                <pre className="error-message" role="alert">
                    {error}
                </pre>
            )}
        </div>
    );
}
