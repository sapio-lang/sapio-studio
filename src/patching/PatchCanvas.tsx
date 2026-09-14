import { useEffect, useRef, useState } from 'react';
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    MarkerType,
    Position,
    applyNodeChanges,
    useUpdateNodeInternals,
    type Connection,
    type Edge,
    type Node,
    type NodeProps,
} from '@xyflow/react';
import {
    Cable,
    CheckCircle2,
    ChevronDown,
    FolderOpen,
    Play,
    Plus,
    Save,
    Trash2,
    X,
} from 'lucide-react';
import type { JsonValue, ModuleInfo } from '../../shared/studio';
import {
    assertJsonNumbers,
    checkConnection,
    parsePatch,
    runPatch,
    type Patch,
    type PatchConnection,
    type PatchNode,
    type PatchRuntime,
} from './engine';
import {
    initialArguments,
    modulePorts,
    schemaLabel,
    type SchemaPort,
} from './schema';
import { clauseTrampolinePatch } from './demo';
import '@xyflow/react/dist/style.css';
import './patching.css';

export interface PatchCanvasProps extends PatchRuntime {
    modules: ModuleInfo[];
    context: JsonValue;
    onResult?: (value: JsonValue, moduleKey: string) => void;
    onInvalidate?: () => void;
    onContextChange?: (context: JsonValue) => void;
    onLoadModules?: (keys: string[]) => Promise<void>;
    addModule?: { key: string; sequence: number } | null;
    example?: {
        clauseKey: string;
        trampolineKey: string;
        sequence: number;
    } | null;
}

type ModuleNodeData = {
    module?: ModuleInfo;
    patchNode: PatchNode;
    expanded: boolean;
    status?: 'running' | 'complete';
    onExpand: () => void;
};
type FlowModule = Node<ModuleNodeData, 'module'>;

function visiblePorts(ports: SchemaPort[], expanded: boolean): SchemaPort[] {
    if (expanded) return ports;
    return ports
        .filter(
            (port) =>
                port.path === '' ||
                port.path.split('/').length === 2 ||
                port.kind === 'module',
        )
        .slice(0, 16);
}

function ModuleCard({ id, data, selected }: NodeProps<FlowModule>) {
    const updateInternals = useUpdateNodeInternals();
    useEffect(() => {
        updateInternals(id);
    }, [data.expanded, id, updateInternals]);
    const inputs = data.module ? modulePorts(data.module, 'arguments') : [];
    const outputs = data.module ? modulePorts(data.module, 'returns') : [];
    return (
        <article
            className={`patch-module ${selected ? 'patch-module-selected' : ''} ${data.status ?? ''}`}
        >
            <header className="patch-module-title">
                <span className="patch-module-icon">
                    <Cable size={16} />
                </span>
                <div>
                    <strong>{data.module?.name ?? 'Missing module'}</strong>
                    <code>{data.patchNode.moduleKey.slice(0, 10)}…</code>
                </div>
                {data.status === 'complete' && (
                    <CheckCircle2 size={16} aria-label="Completed" />
                )}
            </header>
            <div
                className="patch-module-ref"
                title="Pass this module's immutable hash. Its parameters are supplied by the calling module, not this card."
            >
                <span>Module reference</span>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="module"
                    className="patch-handle-module"
                    aria-label={`${data.module?.name} module reference output`}
                />
            </div>
            <div className="patch-module-ports">
                <div className="patch-module-inputs">
                    <small>ARGUMENTS</small>
                    {visiblePorts(inputs, data.expanded).map((port) => (
                        <div
                            key={port.path}
                            className="patch-port-row"
                            title={`${port.label} · ${schemaLabel(port)}`}
                        >
                            <Handle
                                type="target"
                                position={Position.Left}
                                id={`input:${port.path}`}
                                className={
                                    port.kind === 'module'
                                        ? 'patch-handle-module'
                                        : ''
                                }
                                aria-label={`${data.module?.name} input ${port.label}`}
                            />
                            <span>{port.label}</span>
                            <em>{schemaLabel(port)}</em>
                        </div>
                    ))}
                </div>
                <div className="patch-module-outputs">
                    <small>RESULT</small>
                    {visiblePorts(outputs, data.expanded).map((port) => (
                        <div
                            key={port.path}
                            className="patch-port-row"
                            title={`${port.label} · ${schemaLabel(port)}`}
                        >
                            <span>{port.label}</span>
                            <em>{schemaLabel(port)}</em>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={`value:${port.path}`}
                                aria-label={`${data.module?.name} output ${port.label}`}
                            />
                        </div>
                    ))}
                </div>
            </div>
            {inputs.length + outputs.length > 4 && (
                <button className="patch-expand nodrag" onClick={data.onExpand}>
                    <ChevronDown size={12} />{' '}
                    {data.expanded ? 'Compact sockets' : 'All sockets'}
                </button>
            )}
        </article>
    );
}

const nodeTypes = { module: ModuleCard };
const emptyPatch = (): Patch => ({ version: 1, nodes: [], connections: [] });
const errorText = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

export function PatchCanvas(props: PatchCanvasProps) {
    const {
        modules,
        context,
        invoke,
        validate,
        onResult,
        onInvalidate,
        onContextChange,
        onLoadModules,
        addModule,
        example,
    } = props;
    const [patch, setPatch] = useState<Patch>(emptyPatch);
    const [selected, setSelected] = useState<string | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [status, setStatus] = useState<
        Record<string, 'running' | 'complete'>
    >({});
    const [argumentText, setArgumentText] = useState('{}');
    const [argumentError, setArgumentError] = useState('');
    const [message, setMessage] = useState('');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<JsonValue | undefined>();
    const [moduleChoice, setModuleChoice] = useState('');
    const [connectSource, setConnectSource] = useState('');
    const [connectOutput, setConnectOutput] = useState('module');
    const [connectTarget, setConnectTarget] = useState('');
    const [connectInput, setConnectInput] = useState('input:');
    const lastAdded = useRef<number | null>(null);
    const lastExample = useRef<number | undefined>(undefined);
    const nextId = useRef(0);
    const resultRevision = useRef(0);
    const selectedNode = patch.nodes.find((node) => node.id === selected);
    const selectedModule = modules.find(
        (module) => module.key === selectedNode?.moduleKey,
    );

    function clearResult() {
        // A result that completes after an edit must not replace the cleared
        // output in either this panel or the application export bar.
        resultRevision.current += 1;
        setResult(undefined);
        onInvalidate?.();
    }

    function add(key: string) {
        const module = modules.find((item) => item.key === key);
        if (!module) return;
        const id = `module-${Date.now()}-${nextId.current++}`;
        setPatch((current) => ({
            ...current,
            nodes: [
                ...current.nodes,
                {
                    id,
                    moduleKey: key,
                    arguments: initialArguments(module),
                    position: {
                        x: 60 + (current.nodes.length % 3) * 380,
                        y: 60 + Math.floor(current.nodes.length / 3) * 340,
                    },
                },
            ],
        }));
        setSelected(id);
        setMessage('');
        setStatus({});
        clearResult();
    }

    useEffect(() => {
        if (addModule && lastAdded.current !== addModule.sequence) {
            lastAdded.current = addModule.sequence;
            add(addModule.key);
        }
        // The sequence is an explicit user action, not module-list synchronization.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addModule?.sequence]);

    useEffect(() => {
        if (!example || lastExample.current === example.sequence) return;
        const provider = modules.find(
            (module) => module.key === example.clauseKey,
        );
        const caller = modules.find(
            (module) => module.key === example.trampolineKey,
        );
        if (!provider || !caller) return;
        lastExample.current = example.sequence;
        const sample = clauseTrampolinePatch(provider.key, caller.key);
        setPatch(sample);
        setSelected('trampoline');
        setArgumentText(JSON.stringify(sample.nodes[1]!.arguments, null, 2));
        setArgumentError('');
        setStatus({});
        clearResult();
        onContextChange?.(sample.context);
        setMessage(
            'This patch calls the clause module from inside another WASM module. Select Build selected to execute it.',
        );
    }, [example, modules, onContextChange]);

    useEffect(() => {
        setArgumentText(JSON.stringify(selectedNode?.arguments ?? {}, null, 2));
        setArgumentError('');
        // Preserve the editing cursor and formatting until another node is selected.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedNode?.id]);

    useEffect(() => {
        setStatus({});
        clearResult();
    }, [context]);

    const flowNodes: FlowModule[] = patch.nodes.map((node) => ({
        id: node.id,
        type: 'module',
        position: node.position,
        selected: !selectedEdge && node.id === selected,
        ariaLabel: `${modules.find((module) => module.key === node.moduleKey)?.name ?? 'Missing'} module`,
        data: {
            module: modules.find((module) => module.key === node.moduleKey),
            patchNode: node,
            expanded: expanded.has(node.id),
            status: status[node.id],
            onExpand: () =>
                setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                }),
        },
    }));
    const flowEdges: Edge[] = patch.connections.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle:
            edge.kind === 'module' ? 'module' : `value:${edge.sourcePath}`,
        targetHandle: `input:${edge.targetPath}`,
        type: 'smoothstep',
        label:
            edge.kind === 'module' ? 'module' : edge.targetPath || 'arguments',
        ariaLabel:
            edge.kind === 'module'
                ? 'Module reference; compatibility is checked when Sapio calls it.'
                : `Value connection to ${edge.targetPath || 'arguments'}`,
        selected: edge.id === selectedEdge,
        style: {
            stroke: edge.kind === 'module' ? '#aa7937' : '#287c73',
            strokeDasharray: edge.kind === 'module' ? '5 4' : undefined,
        },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edge.kind === 'module' ? '#aa7937' : '#287c73',
        },
    }));

    function connection(input: Connection): PatchConnection | null {
        if (
            !input.source ||
            !input.target ||
            !input.targetHandle?.startsWith('input:')
        )
            return null;
        if (
            input.sourceHandle !== 'module' &&
            !input.sourceHandle?.startsWith('value:')
        )
            return null;
        return {
            id: `wire-${Date.now()}-${nextId.current++}`,
            kind: input.sourceHandle === 'module' ? 'module' : 'value',
            source: input.source,
            sourcePath:
                input.sourceHandle === 'module'
                    ? ''
                    : input.sourceHandle!.slice(6),
            target: input.target,
            targetPath: input.targetHandle.slice(6),
        };
    }

    function connect(input: Connection) {
        const edge = connection(input);
        if (!edge) {
            setMessage('Choose an output and an argument socket.');
            return;
        }
        const error = checkConnection(patch, modules, edge);
        if (error) {
            setMessage(error);
            return;
        }
        setPatch((current) => ({
            ...current,
            connections: [...current.connections, edge],
        }));
        setExpanded((current) =>
            new Set(current).add(edge.source).add(edge.target),
        );
        setStatus({});
        clearResult();
        setMessage(
            edge.kind === 'module'
                ? 'Module reference connected. The current API does not advertise its expected signature; Sapio checks the nested call when executed.'
                : 'Connected. Actual inputs and outputs will be validated before each module executes.',
        );
    }

    async function run() {
        if (!selectedNode || running) return;
        if (argumentError) {
            setMessage('Fix the argument JSON before running the patch.');
            return;
        }
        setRunning(true);
        setMessage('');
        setStatus({});
        clearResult();
        const revision = resultRevision.current;
        try {
            const completed = await runPatch(
                patch,
                modules,
                selectedNode.id,
                context,
                { invoke, validate },
                (progress) => {
                    if (revision !== resultRevision.current) return;
                    setStatus((current) => ({
                        ...current,
                        [progress.node]: progress.state,
                    }));
                },
            );
            if (revision !== resultRevision.current) {
                setMessage(
                    'The patch changed while building. Build again to use its current inputs.',
                );
                return;
            }
            setResult(completed.output);
            setMessage(
                `Built ${selectedModule?.name ?? 'result'}; ${completed.executed.length} module invocation${completed.executed.length === 1 ? '' : 's'} completed.`,
            );
            onResult?.(completed.output, selectedNode.moduleKey);
        } catch (error) {
            setMessage(errorText(error));
        } finally {
            setRunning(false);
        }
    }

    async function save() {
        if (argumentError) {
            setMessage('Fix the argument JSON before saving the patch.');
            return;
        }
        try {
            if (!window.studio)
                throw new Error('Saving patch files requires the desktop app.');
            await window.studio.documents.save({
                kind: 'json',
                name: 'patch.sapio.json',
                text: JSON.stringify({ ...patch, context }, null, 2),
            });
        } catch (error) {
            setMessage(errorText(error));
        }
    }

    async function open() {
        try {
            if (!window.studio)
                throw new Error(
                    'Opening patch files requires the desktop app.',
                );
            const document = await window.studio.documents.open('json');
            if (!document) return;
            const imported = parsePatch(document.text);
            const keys = [
                ...new Set(imported.nodes.map((node) => node.moduleKey)),
            ];
            if (onLoadModules) {
                setMessage('Resolving the patch’s module hashes…');
                await onLoadModules(keys);
            } else {
                const missing = keys.find(
                    (key) => !modules.some((module) => module.key === key),
                );
                if (missing)
                    throw new Error(
                        `Missing module ${missing}. Load that exact WASM module in this workspace before opening the patch.`,
                    );
            }
            if (onContextChange) onContextChange(imported.context);
            else if (
                JSON.stringify(imported.context) !== JSON.stringify(context)
            )
                throw new Error(
                    'This patch has a different context. Set its network, amount and lowering before opening.',
                );
            setPatch({
                version: 1,
                nodes: imported.nodes,
                connections: imported.connections,
            });
            setSelected(imported.nodes.at(-1)?.id ?? null);
            setSelectedEdge(null);
            setExpanded(
                new Set(
                    imported.connections.flatMap((edge) => [
                        edge.source,
                        edge.target,
                    ]),
                ),
            );
            setConnectSource('');
            setConnectTarget('');
            setArgumentText(
                JSON.stringify(imported.nodes.at(-1)?.arguments ?? {}, null, 2),
            );
            setArgumentError('');
            setStatus({});
            clearResult();
            setMessage(`Opened ${document.name}. Module hashes remain pinned.`);
        } catch (error) {
            setMessage(errorText(error));
        }
    }

    function removeSelected() {
        if (selectedEdge) {
            setPatch((current) => ({
                ...current,
                connections: current.connections.filter(
                    (edge) => edge.id !== selectedEdge,
                ),
            }));
            setSelectedEdge(null);
        } else if (selected) {
            setPatch((current) => ({
                ...current,
                nodes: current.nodes.filter((node) => node.id !== selected),
                connections: current.connections.filter(
                    (edge) =>
                        edge.source !== selected && edge.target !== selected,
                ),
            }));
            setSelected(null);
        }
        setStatus({});
        clearResult();
    }

    const sourceModule = modules.find(
        (module) =>
            module.key ===
            patch.nodes.find((node) => node.id === connectSource)?.moduleKey,
    );
    const targetModule = modules.find(
        (module) =>
            module.key ===
            patch.nodes.find((node) => node.id === connectTarget)?.moduleKey,
    );
    const clause = modules.find((module) => module.key === example?.clauseKey);
    const trampoline = modules.find(
        (module) => module.key === example?.trampolineKey,
    );

    return (
        <section className="patch-workspace" aria-label="Visual module patch">
            <div className="patch-toolbar">
                <div className="patch-add-control">
                    <select
                        aria-label="Module to add"
                        value={moduleChoice}
                        onChange={(event) =>
                            setModuleChoice(event.target.value)
                        }
                    >
                        <option value="">Choose a module</option>
                        {modules.map((module) => (
                            <option value={module.key} key={module.key}>
                                {module.name}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => add(moduleChoice)}
                        disabled={!moduleChoice || running}
                    >
                        <Plus size={15} /> Add
                    </button>
                </div>
                <div className="patch-toolbar-right">
                    <button onClick={open} disabled={running}>
                        <FolderOpen size={15} /> Open patch
                    </button>
                    <button
                        onClick={save}
                        disabled={!patch.nodes.length || running}
                    >
                        <Save size={15} /> Save
                    </button>
                    <button
                        onClick={removeSelected}
                        disabled={(!selected && !selectedEdge) || running}
                        aria-label="Remove selected node or connection"
                    >
                        <Trash2 size={15} />
                    </button>
                    <button
                        className="patch-run"
                        onClick={run}
                        disabled={!selectedNode || running || !!argumentError}
                    >
                        <Play size={14} />{' '}
                        {running ? 'Building…' : 'Build selected'}
                    </button>
                </div>
            </div>
            <div className="patch-stage">
                <div className="patch-flow">
                    <ReactFlow<FlowModule>
                        nodes={flowNodes}
                        edges={flowEdges}
                        nodeTypes={nodeTypes}
                        onNodesChange={(changes) => {
                            const chosen = changes.find(
                                (change) =>
                                    change.type === 'select' && change.selected,
                            );
                            if (chosen?.type === 'select') {
                                setSelected(chosen.id);
                                setSelectedEdge(null);
                            } else {
                                const deselected = new Set(
                                    changes.flatMap((change) =>
                                        change.type === 'select' &&
                                        !change.selected
                                            ? [change.id]
                                            : [],
                                    ),
                                );
                                setSelected((current) =>
                                    current && deselected.has(current)
                                        ? null
                                        : current,
                                );
                            }
                            if (running) return;
                            if (
                                !changes.some(
                                    (change) =>
                                        change.type === 'position' ||
                                        change.type === 'remove',
                                )
                            )
                                return;
                            if (
                                changes.some(
                                    (change) => change.type === 'remove',
                                )
                            ) {
                                if (
                                    changes.some(
                                        (change) =>
                                            change.type === 'remove' &&
                                            change.id === selected,
                                    )
                                )
                                    setSelected(null);
                                setStatus({});
                                clearResult();
                            }
                            const updated = applyNodeChanges(
                                changes,
                                flowNodes,
                            );
                            setPatch((current) => ({
                                ...current,
                                nodes: current.nodes
                                    .filter((node) =>
                                        updated.some(
                                            (item) => item.id === node.id,
                                        ),
                                    )
                                    .map((node) => ({
                                        ...node,
                                        position: updated.find(
                                            (item) => item.id === node.id,
                                        )!.position,
                                    })),
                                connections: current.connections.filter(
                                    (edge) =>
                                        updated.some(
                                            (node) => node.id === edge.source,
                                        ) &&
                                        updated.some(
                                            (node) => node.id === edge.target,
                                        ),
                                ),
                            }));
                        }}
                        onEdgesChange={(changes) => {
                            const chosen = changes.find(
                                (change) =>
                                    change.type === 'select' && change.selected,
                            );
                            if (chosen?.type === 'select') {
                                setSelected(null);
                                setSelectedEdge(chosen.id);
                            } else {
                                const deselected = new Set(
                                    changes.flatMap((change) =>
                                        change.type === 'select' &&
                                        !change.selected
                                            ? [change.id]
                                            : [],
                                    ),
                                );
                                setSelectedEdge((current) =>
                                    current && deselected.has(current)
                                        ? null
                                        : current,
                                );
                            }
                            if (running) return;
                            const removed = new Set(
                                changes
                                    .filter(
                                        (change) => change.type === 'remove',
                                    )
                                    .map((change) => change.id),
                            );
                            if (removed.size) {
                                if (selectedEdge && removed.has(selectedEdge))
                                    setSelectedEdge(null);
                                setPatch((current) => ({
                                    ...current,
                                    connections: current.connections.filter(
                                        (edge) => !removed.has(edge.id),
                                    ),
                                }));
                                setStatus({});
                                clearResult();
                            }
                        }}
                        onNodeClick={(_, node) => {
                            setSelected(node.id);
                            setSelectedEdge(null);
                        }}
                        onEdgeClick={(_, edge) => {
                            setSelected(null);
                            setSelectedEdge(edge.id);
                        }}
                        onConnect={connect}
                        nodesDraggable={!running}
                        nodesConnectable={!running}
                        deleteKeyCode={running ? null : ['Backspace', 'Delete']}
                        defaultViewport={{ x: 20, y: 20, zoom: 1 }}
                        minZoom={0.15}
                        maxZoom={1.5}
                        fitView={false}
                        proOptions={{ hideAttribution: false }}
                    >
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={20}
                            size={1}
                            color="#bcbdb4"
                        />
                        <Controls showInteractive={false} />
                    </ReactFlow>
                    {patch.nodes.length === 0 && (
                        <div className="patch-empty">
                            <span className="patch-empty-icon">
                                <Cable size={30} strokeWidth={1.3} />
                            </span>
                            <h2>
                                Compose a contract, one connection at a time.
                            </h2>
                            <p>
                                Add modules from the library. Wire compatible
                                result sockets into arguments, or pass a module
                                reference for Sapio to call.
                            </p>
                            {clause && trampoline && (
                                <button
                                    onClick={() => {
                                        const sample = clauseTrampolinePatch(
                                            clause.key,
                                            trampoline.key,
                                        );
                                        setPatch(sample);
                                        setStatus({});
                                        clearResult();
                                        setSelected('trampoline');
                                        onContextChange?.(sample.context);
                                    }}
                                >
                                    <Plus size={15} /> Open clause composition
                                    example
                                </button>
                            )}
                            <div className="patch-legend">
                                <span>
                                    <i /> JSON value
                                </span>
                                <span>
                                    <i className="reference" /> Module reference
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                {selectedNode && (
                    <aside
                        className="patch-inspector"
                        aria-label="Selected module parameters"
                    >
                        <header>
                            <div>
                                <small>MODULE PARAMETERS</small>
                                <h3>
                                    {selectedModule?.name ?? 'Missing module'}
                                </h3>
                            </div>
                            <button
                                aria-label="Close module inspector"
                                onClick={() => setSelected(null)}
                            >
                                <X size={16} />
                            </button>
                        </header>
                        <p className="patch-inspector-description">
                            {selectedModule?.description ||
                                'Edit the literal arguments. Connected sockets receive their values when you build.'}
                        </p>
                        <label htmlFor="patch-arguments">Arguments JSON</label>
                        <textarea
                            id="patch-arguments"
                            className="patch-json"
                            spellCheck={false}
                            value={argumentText}
                            disabled={running}
                            onChange={(event) => {
                                setArgumentText(event.target.value);
                                setStatus({});
                                clearResult();
                                try {
                                    const argumentsValue: JsonValue =
                                        JSON.parse(event.target.value);
                                    assertJsonNumbers(
                                        argumentsValue,
                                        'Arguments',
                                    );
                                    setPatch((current) => ({
                                        ...current,
                                        nodes: current.nodes.map((node) =>
                                            node.id === selected
                                                ? {
                                                      ...node,
                                                      arguments: argumentsValue,
                                                  }
                                                : node,
                                        ),
                                    }));
                                    setArgumentError('');
                                } catch (error) {
                                    setArgumentError(errorText(error));
                                }
                            }}
                        />
                        {argumentError && (
                            <p className="patch-field-error" role="alert">
                                {argumentError}
                            </p>
                        )}
                        <div className="patch-context-note">
                            Network, available funds and covenant lowering come
                            from the shared compilation context.
                        </div>
                        <details className="patch-wire-editor">
                            <summary>Connect sockets without dragging</summary>
                            <label>
                                Source module
                                <select
                                    value={connectSource}
                                    onChange={(event) => {
                                        setConnectSource(event.target.value);
                                        setConnectOutput('module');
                                    }}
                                >
                                    <option value="">Select source</option>
                                    {patch.nodes.map((node) => (
                                        <option key={node.id} value={node.id}>
                                            {modules.find(
                                                (module) =>
                                                    module.key ===
                                                    node.moduleKey,
                                            )?.name ?? node.id}{' '}
                                            · {node.id.slice(-4)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Output
                                <select
                                    value={connectOutput}
                                    onChange={(event) =>
                                        setConnectOutput(event.target.value)
                                    }
                                >
                                    <option value="module">
                                        Module reference (hash)
                                    </option>
                                    {sourceModule &&
                                        modulePorts(
                                            sourceModule,
                                            'returns',
                                        ).map((port) => (
                                            <option
                                                key={port.path}
                                                value={`value:${port.path}`}
                                            >
                                                {port.label} ·{' '}
                                                {schemaLabel(port)}
                                            </option>
                                        ))}
                                </select>
                            </label>
                            <label>
                                Destination module
                                <select
                                    value={connectTarget}
                                    onChange={(event) => {
                                        setConnectTarget(event.target.value);
                                        setConnectInput('input:');
                                    }}
                                >
                                    <option value="">Select destination</option>
                                    {patch.nodes.map((node) => (
                                        <option key={node.id} value={node.id}>
                                            {modules.find(
                                                (module) =>
                                                    module.key ===
                                                    node.moduleKey,
                                            )?.name ?? node.id}{' '}
                                            · {node.id.slice(-4)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Input
                                <select
                                    value={connectInput}
                                    onChange={(event) =>
                                        setConnectInput(event.target.value)
                                    }
                                >
                                    {targetModule ? (
                                        modulePorts(
                                            targetModule,
                                            'arguments',
                                        ).map((port) => (
                                            <option
                                                key={port.path}
                                                value={`input:${port.path}`}
                                            >
                                                {port.label} ·{' '}
                                                {schemaLabel(port)}
                                            </option>
                                        ))
                                    ) : (
                                        <option value="input:">
                                            Select destination first
                                        </option>
                                    )}
                                </select>
                            </label>
                            <button
                                disabled={
                                    running || !connectSource || !connectTarget
                                }
                                onClick={() =>
                                    connect({
                                        source: connectSource,
                                        target: connectTarget,
                                        sourceHandle: connectOutput,
                                        targetHandle: connectInput,
                                    })
                                }
                            >
                                <Cable size={14} /> Connect
                            </button>
                        </details>
                        {patch.connections.some(
                            (edge) =>
                                edge.target === selected &&
                                edge.kind === 'module',
                        ) && (
                            <p className="patch-reference-note">
                                Module references use an immutable WASM hash.
                                This API does not advertise a typed module
                                signature; compatibility is checked by Sapio
                                when the module calls it. The provider card's
                                parameter values are not passed along this wire.
                            </p>
                        )}
                        {result !== undefined && (
                            <details open className="patch-result">
                                <summary>Last build result</summary>
                                <pre>{JSON.stringify(result, null, 2)}</pre>
                            </details>
                        )}
                    </aside>
                )}
            </div>
            <footer className="patch-status" role="status">
                <span>
                    {message ||
                        'Select a module to edit its parameters and build its result. Value dependencies execute in order.'}
                </span>
                <small>
                    {patch.nodes.length} module
                    {patch.nodes.length === 1 ? '' : 's'} ·{' '}
                    {patch.connections.length} connection
                    {patch.connections.length === 1 ? '' : 's'}
                </small>
            </footer>
        </section>
    );
}
