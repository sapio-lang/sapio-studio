import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { JsonObject, JsonValue } from '../shared/studio';
import { DocumentField, errorMessage } from './ui';

export function isObject(value: JsonValue | undefined): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function Dialog({
    title,
    children,
    onClose,
    wide = false,
}: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (dialog && !dialog.open) dialog.showModal();
        return () => dialog?.close();
    }, []);
    return (
        <dialog
            ref={ref}
            className={`studio-dialog ${wide ? 'wide-dialog' : ''}`}
            aria-label={title}
            onCancel={onClose}
        >
            <header>
                <span>{title}</span>
                <button
                    className="icon-button"
                    onClick={onClose}
                    aria-label={`Close ${title}`}
                >
                    <X size={19} />
                </button>
            </header>
            <div className="dialog-body">{children}</div>
        </dialog>
    );
}

export function ContextEditor({
    value,
    onSave,
}: {
    value: JsonValue;
    onSave: (value: JsonValue) => void;
}) {
    const [text, setText] = useState(JSON.stringify(value, null, 2));
    const [error, setError] = useState('');
    let context: JsonObject = {};
    try {
        const parsed: JsonValue = JSON.parse(text);
        if (isObject(parsed)) context = parsed;
    } catch {
        /* Keep incomplete JSON editable. */
    }
    const lowering = context.lowering;
    const emulation =
        isObject(lowering) && isObject(lowering.CtvEmulation)
            ? lowering.CtvEmulation
            : null;
    const update = (next: JsonObject) => setText(JSON.stringify(next, null, 2));
    return (
        <div className="context-editor">
            <div className="section-overline">Deterministic inputs</div>
            <h2>Compilation context</h2>
            <p className="muted">
                Every module in a patch receives this explicit context. Changing
                these values changes the program being compiled.
            </p>
            <div className="form-row">
                <label>
                    Network
                    <select
                        value={String(context.network ?? 'Regtest')}
                        onChange={(event) =>
                            update({ ...context, network: event.target.value })
                        }
                    >
                        {[
                            'Regtest',
                            'Signet',
                            'Testnet4',
                            'Testnet',
                            'Bitcoin',
                        ].map((network) => (
                            <option key={network}>{network}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Available amount (sat)
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={
                            typeof context.amount === 'number'
                                ? context.amount
                                : ''
                        }
                        onChange={(event) =>
                            update({
                                ...context,
                                amount: Number(event.target.value),
                            })
                        }
                    />
                </label>
            </div>
            <label>
                Covenant lowering
                <select
                    value={emulation ? 'emulated' : 'native'}
                    onChange={(event) =>
                        update({
                            ...context,
                            lowering:
                                event.target.value === 'native'
                                    ? 'Native'
                                    : {
                                          CtvEmulation: {
                                              threshold: 1,
                                              signers: [],
                                          },
                                      },
                        })
                    }
                >
                    <option value="native">Native CTV</option>
                    <option value="emulated">
                        CTV emulation with public signer roots
                    </option>
                </select>
            </label>
            {emulation ? (
                <>
                    <label>
                        Public signer roots
                        <textarea
                            rows={4}
                            value={
                                Array.isArray(emulation.signers)
                                    ? emulation.signers.join('\n')
                                    : ''
                            }
                            placeholder="One extended public key per line"
                            onChange={(event) =>
                                update({
                                    ...context,
                                    lowering: {
                                        CtvEmulation: {
                                            ...emulation,
                                            signers: event.target.value
                                                .split('\n')
                                                .filter((line) => line.trim()),
                                        },
                                    },
                                })
                            }
                        />
                    </label>
                    <label>
                        Required signers
                        <input
                            type="number"
                            min={1}
                            step={1}
                            value={Number(emulation.threshold ?? 1)}
                            onChange={(event) =>
                                update({
                                    ...context,
                                    lowering: {
                                        CtvEmulation: {
                                            ...emulation,
                                            threshold: Number(
                                                event.target.value,
                                            ),
                                        },
                                    },
                                })
                            }
                        />
                    </label>
                </>
            ) : (
                <p className="notice">
                    Native lowering assumes the deployment enforces CTV
                    semantics. Selecting a network does not establish opcode
                    activation.
                </p>
            )}
            <details>
                <summary>Full context JSON, including effects</summary>
                <DocumentField
                    label="Context JSON"
                    value={text}
                    onChange={setText}
                    rows={10}
                />
            </details>
            {error && (
                <p className="error-message" role="alert">
                    {error}
                </p>
            )}
            <button
                className="button primary"
                onClick={() => {
                    try {
                        const parsed: JsonValue = JSON.parse(text);
                        if (
                            !isObject(parsed) ||
                            !Number.isSafeInteger(parsed.amount) ||
                            Number(parsed.amount) < 0 ||
                            typeof parsed.network !== 'string' ||
                            parsed.lowering === undefined
                        )
                            throw new Error(
                                'Context requires a network, explicit lowering, and a nonnegative safe integer amount in satoshis.',
                            );
                        onSave(parsed);
                    } catch (error) {
                        setError(errorMessage(error));
                    }
                }}
            >
                Use context
                <ArrowRight size={15} />
            </button>
        </div>
    );
}
