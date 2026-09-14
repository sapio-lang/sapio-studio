import { Check, Copy, FileUp, LoaderCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { DocumentKind, StudioAPI } from '../shared/studio';

export function formatSats(amount: number) {
    return `${new Intl.NumberFormat('en-US').format(amount)} sat`;
}
export function shortValue(value: unknown): string {
    return typeof value === 'string' ? value : JSON.stringify(value);
}
export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
export function JsonDetails({
    title,
    value,
    open = false,
}: {
    title: string;
    value: unknown;
    open?: boolean;
}) {
    return (
        <details className="json-details" open={open || undefined}>
            <summary>{title}</summary>
            <pre>{JSON.stringify(value, null, 2)}</pre>
        </details>
    );
}
export function Spinner({ label = 'Working' }: { label?: string }) {
    return (
        <span className="inline-status" role="status">
            <LoaderCircle size={15} className="spinner" />
            {label}…
        </span>
    );
}
export function CopyButton({
    text,
    label = 'Copy',
}: {
    text: string;
    label?: string;
}) {
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    return (
        <>
            <button
                type="button"
                className="button subtle small"
                onClick={() => {
                    if (!navigator.clipboard) {
                        setError(
                            'Clipboard access is unavailable. Select the text to copy it.',
                        );
                        return;
                    }
                    setError('');
                    navigator.clipboard
                        .writeText(text)
                        .then(() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        })
                        .catch((error) => setError(errorMessage(error)));
                }}
            >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : label}
            </button>
            {error && <span role="alert">{error}</span>}
        </>
    );
}
export function EmptyState({
    icon,
    title,
    children,
    action,
}: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="empty-state">
            <div className="empty-icon">{icon}</div>
            <h2>{title}</h2>
            <p>{children}</p>
            {action}
        </div>
    );
}
export function DocumentField({
    label,
    value,
    onChange,
    api,
    kind = 'json',
    placeholder,
    rows = 4,
    disabled = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    api?: StudioAPI;
    kind?: DocumentKind;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
}) {
    const [error, setError] = useState('');
    return (
        <div className="document-field">
            <div className="field-heading">
                <label>{label}</label>
                {api && (
                    <button
                        type="button"
                        className="button subtle small"
                        aria-label={`Load ${label} file`}
                        disabled={disabled}
                        onClick={async () => {
                            try {
                                const doc = await api.documents.open(kind);
                                if (doc) {
                                    onChange(doc.text);
                                    setError('');
                                }
                            } catch (error) {
                                setError(errorMessage(error));
                            }
                        }}
                    >
                        <FileUp size={13} />
                        Load file
                    </button>
                )}
            </div>
            <textarea
                aria-label={label}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={rows}
                placeholder={placeholder}
                spellCheck={false}
                disabled={disabled}
            />
            {error && (
                <p className="field-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
