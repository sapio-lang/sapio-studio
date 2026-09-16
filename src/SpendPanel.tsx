import { useEffect, useRef, useState } from 'react';
import {
    ArrowRight,
    CheckCircle2,
    Download,
    FileCheck2,
    KeyRound,
    RefreshCw,
    ShieldCheck,
} from 'lucide-react';
import type {
    BranchPlan,
    IndexedProgramRequest,
    JsonValue,
    ResumeInput,
    SpendSelector,
    StudioAPI,
} from '../shared/studio';
import {
    DocumentField,
    EmptyState,
    JsonDetails,
    Spinner,
    errorMessage,
    shortValue,
} from './ui';

function humanStatus(value: JsonValue) {
    const labels: Record<string, string> = {
        Planned: 'Assets available for planning',
        MissingAssets: 'Missing assets',
        IncompatibleTransaction: 'Transaction mismatch',
        Unsupported: 'Unsupported satisfaction',
        CanProvide: 'Can provide',
        PresentUnverified: 'Present, unchecked',
        PresentVerified: 'Verified',
        Missing: 'Missing',
    };
    return typeof value === 'string'
        ? (labels[value] ?? value)
        : shortValue(value);
}

export interface GraphSpend {
    artifact: string;
    psbt: string;
    location: string;
    label: string;
    mock: boolean;
}

function branchSelector(branch: BranchPlan): SpendSelector {
    return branch.path === 'KeyPath'
        ? 'key'
        : branch.path === 'Descriptor'
          ? 'descriptor'
          : `script:${branch.path.ScriptPath}`;
}

function Requirement({ value }: { value: JsonValue }) {
    const entry =
        typeof value === 'object' && value !== null && !Array.isArray(value)
            ? Object.entries(value)[0]
            : undefined;
    const title = entry
        ? entry[0].replace(/([a-z])([A-Z])/g, '$1 $2')
        : shortValue(value);
    const data = entry?.[1];
    const fields =
        typeof data === 'object' && data !== null && !Array.isArray(data)
            ? data
            : {};
    return (
        <div className="requirement-row">
            <h3>{title === 'Program' ? 'Program authorization' : title}</h3>
            <div className="requirement-availability">
                {['availability', 'signature', 'evidence'].flatMap((key) =>
                    typeof fields[key] === 'string'
                        ? [
                              <span key={key}>
                                  <span>
                                      {key === 'availability'
                                          ? 'Asset'
                                          : key === 'signature'
                                            ? 'Signature'
                                            : 'Evidence'}
                                  </span>
                                  <strong>{humanStatus(fields[key]!)}</strong>
                              </span>,
                          ]
                        : [],
                )}
            </div>
            <JsonDetails title="Requirement details" value={value} />
        </div>
    );
}

export function SpendPanel({
    artifact,
    api,
    source,
    onBack,
}: {
    artifact: string | null;
    api?: StudioAPI;
    source?: GraphSpend | null;
    onBack?: () => void;
}) {
    const [mode, setMode] = useState<'prepare' | 'resume'>('prepare');
    const [funded, setFunded] = useState(source?.psbt ?? '');
    const [assets, setAssets] = useState('');
    const [evidence, setEvidence] = useState('');
    const [path, setPath] = useState('key');
    const [leaf, setLeaf] = useState('');
    const [input, setInput] = useState(0);
    const [intent, setIntent] = useState('');
    const [psbt, setPsbt] = useState('');
    const [status, setStatus] = useState<BranchPlan | null>(null);
    const [requests, setRequests] = useState<IndexedProgramRequest[]>([]);
    const [response, setResponse] = useState('');
    const [responseIndex, setResponseIndex] = useState(0);
    const [finalized, setFinalized] = useState<{
        text: string;
        transaction: boolean;
    } | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [notice, setNotice] = useState('');
    const [branches, setBranches] = useState<BranchPlan[] | null>(null);
    const [funding, setFunding] = useState<string | null>(null);
    const pathRequest = useRef(0);
    function choosePath(selector: string) {
        setPath(selector.startsWith('script:') ? 'script' : selector);
        setLeaf(selector.startsWith('script:') ? selector.slice(7) : '');
    }
    function invalidatePaths() {
        pathRequest.current++;
        setBranches(null);
        setFunding(null);
    }
    async function checkPaths() {
        if (!api || !artifact || !funded.trim()) return;
        const request = ++pathRequest.current;
        const explained = await api.explain({
            artifact,
            psbt: funded,
            input,
            ...(assets.trim() ? { assets } : {}),
        });
        if (request !== pathRequest.current) return;
        const choices = explained.spend?.branches ?? [];
        setBranches(choices);
        setFunding(explained.spend?.funding ?? 'Unknown');
        const possible = choices.filter(
            (branch) => branch.transaction_compatible !== 'Unmet',
        );
        choosePath(possible.length === 1 ? branchSelector(possible[0]!) : '');
    }
    useEffect(() => {
        if (source?.psbt) void run('Checking transaction paths', checkPaths);
        return () => {
            pathRequest.current++;
        };
    }, []);
    const resume: ResumeInput = {
        artifact: artifact ?? '',
        intent,
        ...(psbt.trim() ? { psbt } : {}),
    };
    async function run(label: string, action: () => Promise<void>) {
        setBusy(label);
        setError('');
        setNotice('');
        try {
            await action();
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setBusy('');
        }
    }
    function updatePsbt(value: string) {
        setPsbt(value);
        setStatus(null);
        setRequests([]);
        setFinalized(null);
    }
    function updateIntent(value: string) {
        setIntent(value);
        setPsbt('');
        setResponse('');
        setResponseIndex(0);
        setStatus(null);
        setRequests([]);
        setFinalized(null);
    }
    function prepareNew() {
        setMode('prepare');
        updateIntent('');
        setError('');
        setNotice('');
    }
    const disabled = !api || Boolean(busy);
    if (!artifact)
        return (
            <EmptyState
                icon={<ShieldCheck size={30} />}
                title="Start with a validated contract"
            >
                Import or compile an artifact in Inspect, then select its funded
                PSBT and spending path here.
            </EmptyState>
        );
    return (
        <div className="spend-workspace">
            <div className="page-heading">
                <div>
                    <div className="section-overline">Spend workbench</div>
                    <h1>Prepare. Collect. Complete.</h1>
                    <p>
                        A saved intent fixes the selected path. Sapio validates
                        every response against it.
                    </p>
                </div>
                <span className="badge">Local workflow</span>
            </div>
            {source && (
                <div className="spend-source notice">
                    <div>
                        <strong>From graph: {source.label}</strong>
                        <p>
                            {source.location
                                ? 'Spending the selected child contract.'
                                : 'Spending the root contract.'}{' '}
                            {source.mock
                                ? 'Synthetic funding preview; these are not spendable coins.'
                                : 'Review funding and authorization requirements below.'}
                        </p>
                    </div>
                    <button className="button small" onClick={onBack}>
                        Back to graph
                    </button>
                </div>
            )}
            {!api && (
                <div className="notice">
                    This browser preview shows the workflow. The desktop app
                    runs Sapio and opens local files.
                </div>
            )}
            {error && (
                <pre className="error-message" role="alert">
                    {error}
                </pre>
            )}
            {notice && (
                <div className="success-message" role="status">
                    {notice}
                </div>
            )}
            {busy && (
                <div className="busy-banner">
                    <Spinner label={busy} />
                </div>
            )}
            <div className="spend-columns">
                <section className="work-card">
                    <div className="step-heading">
                        <span>01</span>
                        <div>
                            <h2>Select the spend</h2>
                            <p>Use a funded PSBT or resume a saved intent.</p>
                        </div>
                    </div>
                    <div className="segmented-control">
                        <button
                            className={mode === 'prepare' ? 'active' : ''}
                            disabled={Boolean(busy)}
                            onClick={prepareNew}
                        >
                            Prepare new
                        </button>
                        <button
                            className={mode === 'resume' ? 'active' : ''}
                            disabled={Boolean(busy)}
                            onClick={() => setMode('resume')}
                        >
                            Resume intent
                        </button>
                    </div>
                    {mode === 'prepare' ? (
                        <>
                            <DocumentField
                                label="Funded PSBT"
                                kind="psbt"
                                value={funded}
                                onChange={(value) => {
                                    invalidatePaths();
                                    setFunded(value);
                                }}
                                api={api}
                                disabled={Boolean(busy)}
                                rows={3}
                                placeholder="Base64 PSBT with authenticated previous outputs"
                            />
                            <button
                                className="button small"
                                disabled={disabled || !funded.trim()}
                                onClick={() =>
                                    run(
                                        'Checking transaction paths',
                                        checkPaths,
                                    )
                                }
                            >
                                <RefreshCw size={14} /> Check available paths
                            </button>
                            {branches && (
                                <div className="spend-paths">
                                    <label>
                                        Available spending path
                                        <select
                                            value={
                                                path === 'script'
                                                    ? `script:${leaf}`
                                                    : path
                                            }
                                            disabled={disabled}
                                            onChange={(event) =>
                                                choosePath(event.target.value)
                                            }
                                        >
                                            <option value="">
                                                Choose a spending path
                                            </option>
                                            {branches.map((branch, index) => (
                                                <option
                                                    key={branchSelector(branch)}
                                                    value={branchSelector(
                                                        branch,
                                                    )}
                                                    disabled={
                                                        branch.transaction_compatible ===
                                                        'Unmet'
                                                    }
                                                >
                                                    {branch.path === 'KeyPath'
                                                        ? 'Key path'
                                                        : branch.path ===
                                                            'Descriptor'
                                                          ? 'Descriptor'
                                                          : `Script path ${index + 1}`}{' '}
                                                    ·{' '}
                                                    {branch.transaction_compatible ===
                                                    'Met'
                                                        ? 'Transaction compatible'
                                                        : branch.transaction_compatible ===
                                                            'Unmet'
                                                          ? 'Transaction incompatible'
                                                          : 'Needs further checks'}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <p className="help-text">
                                        Funding:{' '}
                                        {funding === 'Met'
                                            ? 'requirements met'
                                            : funding === 'Unmet'
                                              ? 'requirements not met'
                                              : 'needs further checks'}
                                        . Signatures and other authorizations
                                        are collected after preparing the
                                        intent.
                                    </p>
                                    {branches
                                        .filter(
                                            (branch) =>
                                                branchSelector(branch) ===
                                                (path === 'script'
                                                    ? `script:${leaf}`
                                                    : path),
                                        )
                                        .map((branch) => (
                                            <JsonDetails
                                                key={branchSelector(branch)}
                                                title="Selected spending policy"
                                                value={branch.policy}
                                            />
                                        ))}
                                </div>
                            )}
                            <div className="form-row">
                                {!branches && (
                                    <label>
                                        Spending path
                                        <select
                                            value={path}
                                            onChange={(event) =>
                                                setPath(event.target.value)
                                            }
                                            disabled={Boolean(busy)}
                                        >
                                            <option value="key">
                                                Taproot key path
                                            </option>
                                            <option value="script">
                                                Taproot script path
                                            </option>
                                            <option value="descriptor">
                                                Descriptor
                                            </option>
                                        </select>
                                    </label>
                                )}
                                <label>
                                    Input index
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={input}
                                        onChange={(event) => {
                                            invalidatePaths();
                                            setInput(
                                                Number(event.target.value),
                                            );
                                        }}
                                        disabled={Boolean(busy)}
                                    />
                                </label>
                            </div>
                            {!branches && path === 'script' && (
                                <label>
                                    Tapleaf hash
                                    <input
                                        value={leaf}
                                        onChange={(event) =>
                                            setLeaf(event.target.value)
                                        }
                                        placeholder="64 hex characters"
                                        disabled={Boolean(busy)}
                                    />
                                </label>
                            )}
                            <details className="advanced-fields">
                                <summary>
                                    Spending assets and Program evidence
                                </summary>
                                <DocumentField
                                    label="Assets JSON"
                                    value={assets}
                                    onChange={(value) => {
                                        invalidatePaths();
                                        setAssets(value);
                                    }}
                                    api={api}
                                    disabled={Boolean(busy)}
                                    rows={3}
                                    placeholder="Optional SpendAssets"
                                />
                                <DocumentField
                                    label="Evidence JSON"
                                    value={evidence}
                                    onChange={setEvidence}
                                    api={api}
                                    disabled={Boolean(busy)}
                                    rows={3}
                                    placeholder="Optional ProgramEvidence array"
                                />
                            </details>
                            <button
                                className="button primary"
                                disabled={
                                    disabled ||
                                    !funded.trim() ||
                                    !path ||
                                    (path === 'script' && !leaf.trim())
                                }
                                onClick={() =>
                                    run('Preparing spend', async () => {
                                        if (!api) return;
                                        const selected: SpendSelector =
                                            path === 'script'
                                                ? `script:${leaf}`
                                                : path === 'descriptor'
                                                  ? 'descriptor'
                                                  : 'key';
                                        const prepared =
                                            await api.spend.prepare({
                                                artifact,
                                                psbt: funded,
                                                path: selected,
                                                input,
                                                ...(assets.trim()
                                                    ? { assets }
                                                    : {}),
                                                ...(evidence.trim()
                                                    ? { evidence }
                                                    : {}),
                                            });
                                        setIntent(prepared.intent);
                                        setPsbt(prepared.psbt);
                                        setStatus(prepared.status);
                                        setRequests([]);
                                        setResponse('');
                                        setResponseIndex(0);
                                        setFinalized(null);
                                        setNotice(
                                            'Spend intent prepared. Save the intent and current PSBT before collecting signatures.',
                                        );
                                        setMode('resume');
                                    })
                                }
                            >
                                Prepare intent
                                <ArrowRight size={15} />
                            </button>
                        </>
                    ) : (
                        <>
                            <DocumentField
                                label="Spend intent JSON"
                                value={intent}
                                onChange={updateIntent}
                                api={api}
                                disabled={Boolean(busy)}
                                rows={4}
                            />
                            <DocumentField
                                label="Current PSBT"
                                kind="psbt"
                                value={psbt}
                                onChange={updatePsbt}
                                api={api}
                                disabled={Boolean(busy)}
                                rows={3}
                                placeholder="Optional: use the intent’s baseline when empty"
                            />
                            <button
                                className="button"
                                disabled={disabled || !intent.trim()}
                                onClick={() =>
                                    run('Checking spend', async () => {
                                        if (api)
                                            setStatus(
                                                await api.spend.status(resume),
                                            );
                                    })
                                }
                            >
                                <RefreshCw size={15} />
                                Validate & check status
                            </button>
                        </>
                    )}
                    {intent && (
                        <div className="button-row save-row">
                            <button
                                className="button subtle small"
                                disabled={disabled}
                                onClick={() =>
                                    run('Saving intent', async () => {
                                        await api?.documents.save({
                                            name: 'intent.json',
                                            text: intent,
                                            kind: 'json',
                                        });
                                    })
                                }
                            >
                                <Download size={14} />
                                Save intent
                            </button>
                            {psbt && (
                                <button
                                    className="button subtle small"
                                    disabled={disabled}
                                    onClick={() =>
                                        run('Saving PSBT', async () => {
                                            await api?.documents.save({
                                                name: 'current.psbt',
                                                text: psbt,
                                                kind: 'psbt',
                                            });
                                        })
                                    }
                                >
                                    <Download size={14} />
                                    Save current PSBT
                                </button>
                            )}
                        </div>
                    )}
                </section>
                <section className="work-card">
                    <div className="step-heading">
                        <span>02</span>
                        <div>
                            <h2>Collect authorizations</h2>
                            <p>
                                Export exact requests. Apply their signed
                                responses.
                            </p>
                        </div>
                    </div>
                    <button
                        className="button"
                        disabled={disabled || !intent.trim()}
                        onClick={() =>
                            run('Exporting requests', async () => {
                                if (api) {
                                    const result =
                                        await api.spend.requests(resume);
                                    setRequests(result);
                                    if (result.length === 0)
                                        setNotice(
                                            'This intent has no Program requests. Check its native requirements below.',
                                        );
                                }
                            })
                        }
                    >
                        Load Program requests
                        <ArrowRight size={15} />
                    </button>
                    {requests.map((request) => (
                        <div className="request-card" key={request.index}>
                            <h3>
                                <span className="badge">{request.index}</span>{' '}
                                Program request
                            </h3>
                            <JsonDetails
                                title="Program and signer requirements"
                                value={request.requirement}
                            />
                            <div className="button-row">
                                <button
                                    className="button small"
                                    disabled={disabled}
                                    onClick={() =>
                                        run('Saving request', async () => {
                                            await api?.documents.save({
                                                name: `request-${request.index}.json`,
                                                text: JSON.stringify(
                                                    request.request,
                                                    null,
                                                    2,
                                                ),
                                                kind: 'json',
                                            });
                                        })
                                    }
                                >
                                    <Download size={14} />
                                    Export request
                                </button>
                                <button
                                    className="button subtle small"
                                    disabled={disabled}
                                    onClick={() =>
                                        run(
                                            'Signing Program request',
                                            async () => {
                                                if (!api) return;
                                                const signed =
                                                    await api.spend.signProgram(
                                                        {
                                                            request:
                                                                JSON.stringify(
                                                                    request.request,
                                                                ),
                                                        },
                                                    );
                                                if (signed === null) return;
                                                const updated =
                                                    await api.spend.apply({
                                                        ...resume,
                                                        responses: [
                                                            {
                                                                index: request.index,
                                                                psbt: signed,
                                                            },
                                                        ],
                                                    });
                                                setPsbt(updated.psbt);
                                                setStatus(updated.status);
                                                setFinalized(null);
                                                setNotice(
                                                    `Program response ${request.index} validated and applied.`,
                                                );
                                            },
                                        )
                                    }
                                >
                                    <KeyRound size={14} />
                                    Sign & apply locally
                                </button>
                            </div>
                        </div>
                    ))}
                    <div className="divider" />
                    <DocumentField
                        label="Signed response PSBT"
                        kind="psbt"
                        value={response}
                        onChange={setResponse}
                        api={api}
                        disabled={Boolean(busy)}
                        rows={3}
                    />
                    <div className="form-row">
                        <label>
                            Request index
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={responseIndex}
                                onChange={(event) =>
                                    setResponseIndex(Number(event.target.value))
                                }
                                disabled={Boolean(busy)}
                            />
                        </label>
                        <button
                            className="button"
                            disabled={
                                disabled || !intent.trim() || !response.trim()
                            }
                            onClick={() =>
                                run('Applying response', async () => {
                                    if (!api) return;
                                    const updated = await api.spend.apply({
                                        ...resume,
                                        responses: [
                                            {
                                                index: responseIndex,
                                                psbt: response,
                                            },
                                        ],
                                    });
                                    setPsbt(updated.psbt);
                                    setStatus(updated.status);
                                    setResponse('');
                                    setFinalized(null);
                                    setNotice(
                                        'Response validated and applied. Save the updated PSBT.',
                                    );
                                })
                            }
                        >
                            <CheckCircle2 size={15} />
                            Apply response
                        </button>
                    </div>
                    <details className="advanced-fields">
                        <summary>Sign native requirements locally</summary>
                        <p className="help-text">
                            Choose a key file in the desktop dialog. Private key
                            bytes remain in the Sapio process.
                        </p>
                        <button
                            className="button"
                            disabled={disabled || !intent.trim()}
                            onClick={() =>
                                run('Signing native requirements', async () => {
                                    if (!api) return;
                                    const updated =
                                        await api.spend.signNative(resume);
                                    if (updated) {
                                        setPsbt(updated.psbt);
                                        setStatus(updated.status);
                                        setFinalized(null);
                                    }
                                })
                            }
                        >
                            <KeyRound size={15} />
                            Choose key & sign
                        </button>
                    </details>
                </section>
            </div>
            <section className="work-card completion-card">
                <div className="step-heading">
                    <span>03</span>
                    <div>
                        <h2>Review and complete</h2>
                        <p>
                            Finalization checks the witness and funding rules.
                            Exporting does not broadcast.
                        </p>
                    </div>
                </div>
                {status ? (
                    <>
                        <div className="status-summary">
                            <span className="badge teal">Intent validated</span>
                            <span>
                                Transaction:{' '}
                                <strong>{status.transaction_compatible}</strong>
                            </span>
                            <span>
                                Plan:{' '}
                                <strong>{humanStatus(status.status)}</strong>
                            </span>
                        </div>
                        <div className="requirements-list">
                            {status.requirements.map((requirement, index) => (
                                <Requirement key={index} value={requirement} />
                            ))}
                        </div>
                        <JsonDetails title="Full spend status" value={status} />
                    </>
                ) : (
                    <p className="muted">
                        Prepare an intent or check a resumed spend to see its
                        current requirements.
                    </p>
                )}
                <div className="button-row">
                    <button
                        className="button primary"
                        disabled={disabled || !intent.trim()}
                        onClick={() =>
                            run('Finalizing transaction', async () => {
                                if (!api) return;
                                const text = await api.spend.finalize({
                                    ...resume,
                                    transaction: true,
                                });
                                setFinalized({ text, transaction: true });
                            })
                        }
                    >
                        <FileCheck2 size={16} />
                        Finalize transaction
                    </button>
                    <button
                        className="button"
                        disabled={disabled || !intent.trim()}
                        onClick={() =>
                            run('Finalizing PSBT', async () => {
                                if (!api) return;
                                const text = await api.spend.finalize({
                                    ...resume,
                                    transaction: false,
                                });
                                setFinalized({ text, transaction: false });
                            })
                        }
                    >
                        Finalize PSBT
                    </button>
                </div>
                {finalized && (
                    <div className="finalized-output">
                        <div className="success-message">
                            <CheckCircle2 size={16} />
                            {finalized.transaction
                                ? 'Transaction finalized'
                                : 'PSBT finalized'}
                        </div>
                        <pre>{finalized.text}</pre>
                        <button
                            className="button primary"
                            disabled={disabled}
                            onClick={() =>
                                run('Exporting finalized spend', async () => {
                                    await api?.documents.save({
                                        name: finalized.transaction
                                            ? 'transaction.hex'
                                            : 'final.psbt',
                                        text: finalized.text,
                                        kind: finalized.transaction
                                            ? 'transaction'
                                            : 'psbt',
                                    });
                                })
                            }
                        >
                            <Download size={15} />
                            Export{' '}
                            {finalized.transaction ? 'transaction' : 'PSBT'}
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
