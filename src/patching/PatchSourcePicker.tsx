import { X } from 'lucide-react';
import type { PatchConnection, PatchNode } from './engine';
import { schemaLabel, type SchemaPort } from './schema';

export interface SourceCandidate {
    node: PatchNode;
    port?: SchemaPort;
    edge: PatchConnection;
    reason: string;
    compatible: boolean;
    producer: boolean;
}

interface PatchSourcePickerProps {
    sourcePort: SchemaPort;
    sourceLabel: string | null;
    candidates: SourceCandidate[];
    discovering: boolean;
    nameOf: (node: PatchNode) => string;
    onClose: () => void;
    onDisconnect: () => void;
    onCreateVariable: () => void;
    useCandidate: (candidate: SourceCandidate) => void;
}

export function PatchSourcePicker({
    sourcePort,
    sourceLabel,
    candidates,
    discovering,
    nameOf,
    onClose,
    onDisconnect,
    onCreateVariable,
    useCandidate,
}: PatchSourcePickerProps) {
    return (
        <section
            className="patch-source-picker"
            aria-label="Choose input source"
        >
            <header>
                <h4>
                    {sourcePort.label} · {schemaLabel(sourcePort)}
                </h4>
                <button aria-label="Close source picker" onClick={onClose}>
                    <X size={13} />
                </button>
            </header>
            {sourceLabel !== null ? (
                <>
                    <p>This input is supplied by {sourceLabel}.</p>
                    <button onClick={onDisconnect}>Disconnect source</button>
                </>
            ) : (
                <>
                    {sourcePort.kind === 'value' && (
                        <>
                            <button onClick={onClose}>
                                Enter a value below
                            </button>
                            <button onClick={onCreateVariable}>
                                Create matching Variable
                            </button>
                        </>
                    )}
                    <h5>Compatible sources</h5>
                    {candidates
                        .filter(
                            (candidate) =>
                                candidate.compatible && !candidate.producer,
                        )
                        .map((candidate) => (
                            <button
                                key={`${candidate.node.id}:${candidate.edge.kind}:${candidate.edge.sourcePath}`}
                                title={candidate.reason}
                                onClick={() => useCandidate(candidate)}
                            >
                                {nameOf(candidate.node)}
                                {candidate.port?.path
                                    ? ` · ${candidate.port.label}`
                                    : candidate.edge.kind === 'module'
                                      ? ' · callable implementation'
                                      : ''}
                                <small>{candidate.reason}</small>
                            </button>
                        ))}
                    <h5>Building blocks</h5>
                    {discovering && (
                        <p role="status">Reading module interfaces…</p>
                    )}
                    {candidates
                        .filter(
                            (candidate) =>
                                candidate.compatible && candidate.producer,
                        )
                        .map((candidate) => (
                            <button
                                key={`${candidate.node.id}:${candidate.edge.kind}:${candidate.edge.sourcePath}`}
                                title={candidate.reason}
                                onClick={() => useCandidate(candidate)}
                            >
                                Add {nameOf(candidate.node)}
                                {candidate.port?.path
                                    ? ` · ${candidate.port.label}`
                                    : candidate.edge.kind === 'module'
                                      ? ' · callable implementation'
                                      : ''}
                                <small>{candidate.reason}</small>
                            </button>
                        ))}
                    <details>
                        <summary>Why other sources do not fit</summary>
                        {candidates
                            .filter(
                                (candidate) =>
                                    !candidate.compatible &&
                                    !candidate.producer,
                            )
                            .map((candidate) => (
                                <p
                                    key={`${candidate.node.id}:${candidate.edge.kind}:${candidate.edge.sourcePath}`}
                                >
                                    <strong>
                                        {nameOf(candidate.node)}
                                        {candidate.port?.path
                                            ? ` · ${candidate.port.label}`
                                            : candidate.edge.kind === 'module'
                                              ? ' · callable implementation'
                                              : ''}
                                    </strong>
                                    : {candidate.reason}
                                </p>
                            ))}
                    </details>
                </>
            )}
        </section>
    );
}
