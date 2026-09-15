import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Background,
    Controls,
    Handle,
    MiniMap,
    Position,
    ReactFlow,
    useReactFlow,
    type Edge,
    type Node,
    type NodeProps,
} from '@xyflow/react';
import {
    ArrowDownRight,
    ArrowRight,
    Box,
    Crosshair,
    FileDown,
    GitBranch,
    LockKeyhole,
} from 'lucide-react';
import type {
    Explanation,
    ObjectExplanation,
    TemplateExplanation,
} from '../shared/studio';
import { CopyButton, JsonDetails, formatSats, shortValue } from './ui';
import {
    templateBindingKey,
    type BoundArtifact,
    type BoundTransaction,
} from './artifactSession';

export type ArtifactSelection =
    | { kind: 'output'; object: ObjectExplanation }
    | {
          kind: 'template';
          object: ObjectExplanation;
          template: TemplateExplanation;
      };
type OutputNode = Node<
    {
        title: string;
        object: ObjectExplanation;
        outpoint?: string;
        mock?: boolean;
        allocation?: number;
    },
    'artifact-output'
>;
type TemplateNode = Node<
    { template: TemplateExplanation; linked?: boolean; mock?: boolean },
    'artifact-template'
>;

function OutputCard({ data, selected }: NodeProps<OutputNode>) {
    return (
        <div
            className={`artifact-node output-node ${selected ? 'selected' : ''}`}
        >
            <Handle type="target" position={Position.Top} />
            <div className="node-overline">
                <Box size={13} /> Contract output
            </div>
            <strong>{data.title}</strong>
            <div className="node-value">
                {formatSats(data.allocation ?? data.object.required_input_sats)}{' '}
                <span>
                    {data.allocation === undefined ? 'required' : 'allocated'}
                </span>
            </div>
            <div
                className={`node-binding ${data.outpoint ? 'linked' : ''}`}
                title={data.outpoint}
            >
                {data.outpoint
                    ? `${data.mock ? 'Mock outpoint' : 'Linked outpoint'} · ${data.outpoint.slice(0, 8)}…:${data.outpoint.split(':').at(-1)}`
                    : 'Unbound output'}
            </div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
}

function TemplateCard({ data, selected }: NodeProps<TemplateNode>) {
    const template = data.template;
    return (
        <div
            className={`artifact-node template-node ${selected ? 'selected' : ''} ${template.kind.toLowerCase()}`}
        >
            <Handle type="target" position={Position.Top} />
            <div className="node-overline">
                <GitBranch size={13} /> {template.kind} transaction
            </div>
            <strong>
                {template.outputs.length} output
                {template.outputs.length === 1 ? '' : 's'}{' '}
                <span className="node-hash">{template.hash.slice(0, 8)}</span>
            </strong>
            <div className="node-value">
                {formatSats(template.reserved_fee_sats)}{' '}
                <span>reserved fee</span>
            </div>
            <div className={`node-binding ${data.linked ? 'linked' : ''}`}>
                {data.linked
                    ? data.mock
                        ? 'Mock-linked PSBT'
                        : 'Linked PSBT'
                    : 'Unbound template'}
            </div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
}

const nodeTypes = {
    'artifact-output': OutputCard,
    'artifact-template': TemplateCard,
};

/** Occurrence locations, rather than reusable source paths, identify graph nodes. */
export function artifactLayout(
    explanation: Explanation,
    binding?: BoundArtifact | null,
) {
    const objects = new Map(
        explanation.artifact.nodes.map((object) => [object.location, object]),
    );
    const nodes: (OutputNode | TemplateNode)[] = [];
    const edges: Edge[] = [];
    const selections = new Map<string, ArtifactSelection>();
    let column = 0;
    const visited = new Set<string>();
    function visit(
        location: string,
        title: string,
        depth: number,
        allocation?: number,
    ): number {
        const object = objects.get(location);
        if (!object || visited.has(location)) return column++ * 290;
        visited.add(location);
        const id = `output:${location}`;
        const childColumns: number[] = [];
        for (const template of object.templates) {
            const templateId = `${id}:${template.kind}:${template.hash}`;
            const outputColumns = template.outputs.map((output) => {
                const x = visit(
                    output.contract_location,
                    output.name ?? `Output ${output.index}`,
                    depth + 2,
                    output.amount_sats,
                );
                edges.push({
                    id: `${templateId}:${output.index}`,
                    source: templateId,
                    target: `output:${output.contract_location}`,
                    label: formatSats(output.amount_sats),
                    type: 'smoothstep',
                    style: { stroke: '#80948e', strokeWidth: 1.5 },
                });
                return x;
            });
            const x = outputColumns.length
                ? (outputColumns[0]! + outputColumns.at(-1)!) / 2
                : column++ * 290;
            childColumns.push(x);
            nodes.push({
                id: templateId,
                type: 'artifact-template',
                ariaLabel: `${template.kind} transaction, ${template.outputs.length} outputs, ${formatSats(template.reserved_fee_sats)} reserved fee`,
                position: { x, y: (depth + 1) * 195 },
                data: {
                    template,
                    linked: Boolean(
                        binding?.occurrences[location]?.transactions[
                            templateBindingKey(template)
                        ],
                    ),
                    mock: binding?.funding.kind === 'mock',
                },
            });
            selections.set(templateId, { kind: 'template', object, template });
            edges.push({
                id: templateId,
                source: id,
                target: templateId,
                type: 'smoothstep',
                style: {
                    stroke:
                        template.kind === 'suggested' ? '#b08b4f' : '#497b71',
                    strokeWidth: 1.5,
                    strokeDasharray:
                        template.kind === 'suggested' ? '5 4' : undefined,
                },
            });
        }
        const x = childColumns.length
            ? (childColumns[0]! + childColumns.at(-1)!) / 2
            : column++ * 290;
        nodes.push({
            id,
            type: 'artifact-output',
            ariaLabel: `${title}, ${formatSats(allocation ?? object.required_input_sats)} ${allocation === undefined ? 'required input' : 'allocated'}`,
            position: { x, y: depth * 195 },
            data: {
                title,
                object,
                outpoint: binding?.occurrences[location]?.outpoint,
                mock: binding?.funding.kind === 'mock',
                allocation,
            },
        });
        selections.set(id, { kind: 'output', object });
        return x;
    }
    if (objects.has('')) visit('', 'Contract root', 0);
    for (const object of objects.values())
        if (!visited.has(object.location))
            visit(object.location, shortValue(object.source_path), 0);
    return { nodes, edges, selections };
}

export function selectionId(selection: ArtifactSelection | null) {
    if (!selection) return 'output:';
    const id = `output:${selection.object.location}`;
    return selection.kind === 'output'
        ? id
        : `${id}:${selection.template.kind}:${selection.template.hash}`;
}

function FocusSelection({ id, request }: { id: string; request: number }) {
    const flow = useReactFlow();
    const lastRequest = useRef(request);
    useEffect(() => {
        if (request !== lastRequest.current && request)
            void flow.fitView({
                nodes: [{ id }],
                padding: 0.8,
                maxZoom: 1,
                duration: 200,
            });
        lastRequest.current = request;
        // Navigation focuses a node; ordinary selection preserves the viewport.
    }, [request, id, flow]);
    return null;
}

export function ArtifactGraph({
    explanation,
    binding,
    selection,
    focusRequest = 0,
    onSelect,
}: {
    explanation: Explanation;
    binding?: BoundArtifact | null;
    selection: ArtifactSelection | null;
    focusRequest?: number;
    onSelect: (selection: ArtifactSelection) => void;
}) {
    const graph = useMemo(
        () => artifactLayout(explanation, binding),
        [explanation, binding],
    );
    const [measurements, setMeasurements] = useState<
        Record<string, { width: number; height: number }>
    >({});
    const selectedId = selectionId(selection);
    const nodes = useMemo(
        () =>
            graph.nodes.map((node) => ({
                ...node,
                measured: measurements[node.id],
                selected: node.id === selectedId,
            })),
        [graph.nodes, selectedId, measurements],
    );
    return (
        <div className="artifact-canvas" aria-label="Validated contract graph">
            <ReactFlow
                nodes={nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.18 }}
                minZoom={0.1}
                maxZoom={1.6}
                nodesDraggable={false}
                nodesConnectable={false}
                onNodesChange={(changes) => {
                    setMeasurements((previous) => {
                        let next = previous;
                        for (const change of changes) {
                            if (
                                change.type !== 'dimensions' ||
                                !change.dimensions ||
                                change.dimensions.width <= 0 ||
                                change.dimensions.height <= 0
                            )
                                continue;
                            const old = previous[change.id];
                            if (
                                old?.width === change.dimensions.width &&
                                old.height === change.dimensions.height
                            )
                                continue;
                            if (next === previous) next = { ...previous };
                            next[change.id] = change.dimensions;
                        }
                        return next;
                    });
                    const change = changes.find(
                        (change) => change.type === 'select' && change.selected,
                    );
                    if (change?.type === 'select') {
                        const selected = graph.selections.get(change.id);
                        if (selected) {
                            onSelect(selected);
                        }
                    }
                }}
                onNodeClick={(_, node) => {
                    const selected = graph.selections.get(node.id);
                    if (selected) {
                        onSelect(selected);
                    }
                }}
            >
                <FocusSelection id={selectedId} request={focusRequest} />
                <Background color="#c8d2cd" gap={22} size={1} />
                <Controls showInteractive={false} />
                <MiniMap
                    nodeColor={(node) =>
                        node.type === 'artifact-output' ? '#dbe8e2' : '#426b62'
                    }
                    maskColor="rgba(246,247,243,.7)"
                    pannable
                    zoomable
                />
            </ReactFlow>
            <div className="canvas-legend">
                <span>
                    <i /> Committed
                </span>
                <span>
                    <i className="suggested-line" /> Suggested
                </span>
                <span>Click an output or transaction to inspect</span>
            </div>
        </div>
    );
}

export function ArtifactInspector({
    selection,
    explanation,
    binding,
    disabled,
    onNavigate,
    onBind,
    onSpend,
    onExportPsbt,
    onAction,
}: {
    selection: ArtifactSelection | null;
    explanation: Explanation;
    binding: BoundArtifact | null;
    disabled: boolean;
    onNavigate: (selection: ArtifactSelection) => void;
    onBind: () => void;
    onSpend: (selection: ArtifactSelection) => void;
    onExportPsbt: (transaction: BoundTransaction) => void;
    onAction?: (
        object: ObjectExplanation,
        action: ObjectExplanation['actions'][number],
    ) => void;
}) {
    if (!selection)
        return (
            <div className="inspector-empty">
                <ArrowDownRight size={26} />
                <h3>Follow the contract</h3>
                <p>
                    Select an output or transaction to inspect its funding,
                    policies, and next steps.
                </p>
            </div>
        );
    const object = selection.object;
    const occurrence = binding?.occurrences[object.location];
    const boundTx =
        selection.kind === 'template'
            ? occurrence?.transactions[templateBindingKey(selection.template)]
            : undefined;
    const navigateOutput = (location: string) => {
        const target = explanation.artifact.nodes.find(
            (candidate) => candidate.location === location,
        );
        if (target) onNavigate({ kind: 'output', object: target });
    };
    if (selection.kind === 'template') {
        const tx = selection.template;
        return (
            <div className="inspector-body">
                <span
                    className={`badge ${tx.kind === 'committed' ? 'teal' : 'amber'}`}
                >
                    {tx.kind}
                </span>
                <h2>Transaction template</h2>
                <p className="muted">
                    {tx.kind === 'committed'
                        ? 'This template is committed by the contract.'
                        : 'This is a proposed transaction. Its presence does not grant spending authority.'}
                </p>
                <div className="graph-actions">
                    <span className={`badge ${boundTx ? 'teal' : ''}`}>
                        {boundTx
                            ? binding?.funding.kind === 'mock'
                                ? 'Mock-linked PSBT'
                                : 'Linked PSBT'
                            : 'Unbound template'}
                    </span>
                    {boundTx ? (
                        <>
                            <button
                                className="button primary"
                                disabled={disabled}
                                onClick={() => onSpend(selection)}
                            >
                                Review spend <ArrowRight size={14} />
                            </button>
                            <button
                                className="button small"
                                disabled={disabled}
                                onClick={() => onExportPsbt(boundTx)}
                            >
                                <FileDown size={14} /> Export PSBT
                            </button>
                        </>
                    ) : (
                        <button
                            className="button primary"
                            disabled={disabled}
                            onClick={onBind}
                        >
                            Bind graph to review spend
                        </button>
                    )}
                    <button
                        className="button subtle small"
                        onClick={() => navigateOutput(object.location)}
                    >
                        <Crosshair size={13} /> Go to source contract
                    </button>
                </div>
                <dl className="facts">
                    <div>
                        <dt>Minimum funding</dt>
                        <dd>{formatSats(tx.minimum_funding_sats)}</dd>
                    </div>
                    <div>
                        <dt>Reserved fee</dt>
                        <dd>{formatSats(tx.reserved_fee_sats)}</dd>
                    </div>
                    <div>
                        <dt>Version / locktime</dt>
                        <dd>
                            {tx.version} / {tx.lock_time}
                        </dd>
                    </div>
                </dl>
                <h3>Output allocation</h3>
                <div className="allocation-list">
                    {tx.outputs.map((output) => (
                        <button
                            key={output.index}
                            onClick={() =>
                                navigateOutput(output.contract_location)
                            }
                            title="Go to receiving contract"
                        >
                            <span>
                                <small>
                                    {output.index.toString().padStart(2, '0')}
                                </small>
                                {output.name ?? 'Unnamed output'}
                            </span>
                            <strong>{formatSats(output.amount_sats)}</strong>
                            <ArrowRight size={13} />
                        </button>
                    ))}
                </div>
                <JsonDetails
                    title="Funding constraints"
                    value={tx.funding_constraints}
                />
                <JsonDetails title="Input requirements" value={tx.inputs} />
                <JsonDetails title="Authorization guards" value={tx.guards} />
                <JsonDetails title="Template hash" value={tx.hash} />
            </div>
        );
    }
    return (
        <div className="inspector-body">
            <span className="badge">Contract output</span>
            <h2>
                {object.location === ''
                    ? 'Contract root'
                    : 'Receiving contract'}
            </h2>
            <div className="graph-actions">
                <span className={`badge ${occurrence ? 'teal' : ''}`}>
                    {occurrence
                        ? binding?.funding.kind === 'mock'
                            ? 'Mock-linked output'
                            : 'Linked output'
                        : 'Unbound output'}
                </span>
                {occurrence ? (
                    <>
                        <code className="outpoint-block">
                            {occurrence.outpoint}
                        </code>
                        <CopyButton
                            text={occurrence.outpoint}
                            label="Copy outpoint"
                        />
                        <button
                            className="button small"
                            disabled={disabled}
                            onClick={() => onSpend(selection)}
                        >
                            Prepare custom spend <ArrowRight size={14} />
                        </button>
                    </>
                ) : (
                    <button
                        className="button primary"
                        disabled={disabled}
                        onClick={onBind}
                    >
                        Bind graph
                    </button>
                )}
            </div>
            {explanation.artifact.nodes.flatMap((parent) =>
                parent.templates
                    .filter((tx) =>
                        tx.outputs.some(
                            (output) =>
                                output.contract_location === object.location,
                        ),
                    )
                    .map((tx) => (
                        <button
                            className="button subtle small"
                            key={`${parent.location}:${tx.kind}:${tx.hash}`}
                            onClick={() =>
                                onNavigate({
                                    kind: 'template',
                                    object: parent,
                                    template: tx,
                                })
                            }
                        >
                            <Crosshair size={13} /> Go to creating transaction
                        </button>
                    )),
            )}
            {object.templates.length > 0 && (
                <>
                    <h3>Next transactions</h3>
                    <div className="transaction-choices">
                        {object.templates.map((tx) => (
                            <button
                                key={`${tx.kind}:${tx.hash}`}
                                onClick={() =>
                                    onNavigate({
                                        kind: 'template',
                                        object,
                                        template: tx,
                                    })
                                }
                            >
                                <span>
                                    <strong>
                                        {tx.kind === 'committed'
                                            ? 'Committed'
                                            : 'Suggested'}{' '}
                                        · {tx.hash.slice(0, 8)}
                                    </strong>
                                    <small>
                                        {tx.outputs
                                            .map(
                                                (output) =>
                                                    output.name ??
                                                    `Output ${output.index}`,
                                            )
                                            .join(', ')}
                                    </small>
                                </span>
                                <ArrowRight size={14} />
                            </button>
                        ))}
                    </div>
                </>
            )}
            <dl className="facts">
                <div>
                    <dt>Required input</dt>
                    <dd>{formatSats(object.required_input_sats)}</dd>
                </div>
                <div>
                    <dt>Transactions</dt>
                    <dd>{object.templates.length}</dd>
                </div>
                <div>
                    <dt>Program policies</dt>
                    <dd>{object.program_policies.length}</dd>
                </div>
            </dl>
            <h3>
                <LockKeyhole size={15} /> Destination
            </h3>
            <pre className="address-block">{shortValue(object.address)}</pre>
            <CopyButton
                text={shortValue(object.address)}
                label="Copy destination"
            />
            <JsonDetails title="Descriptor" value={object.descriptor} />
            <JsonDetails
                title="Covenant assumptions"
                value={object.covenants}
            />
            <JsonDetails
                title="Program policies"
                value={object.program_policies}
            />
            {object.actions.length > 0 && (
                <>
                    <h3>Advertised actions</h3>
                    {object.actions.map((action, index) => (
                        <div className="action-entry" key={index}>
                            <strong>{shortValue(action.path)}</strong>
                            <span className="muted">
                                {action.kind ?? 'Unspecified mode'} ·{' '}
                                {action.schema !== null
                                    ? 'JSON request'
                                    : 'Local Rust callback'}
                            </span>
                            {action.schema !== null && (
                                <JsonDetails
                                    title="Request schema"
                                    value={action.schema}
                                />
                            )}
                            {action.schema !== null && (
                                <button
                                    className="button small"
                                    disabled={disabled || !onAction}
                                    onClick={() => onAction?.(object, action)}
                                >
                                    Generate proposal <ArrowRight size={13} />
                                </button>
                            )}
                        </div>
                    ))}
                    <p className="help-text">
                        An advertised action describes a request interface; it
                        is not spending authorization.
                        {!onAction &&
                            ' Build this contract in Studio to retain the source needed to generate proposals.'}
                    </p>
                </>
            )}
            <JsonDetails title="Source path" value={object.source_path} />
            <JsonDetails
                title="Occurrence location"
                value={object.location || '(root)'}
            />
        </div>
    );
}
