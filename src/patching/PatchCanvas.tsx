import { useEffect, useRef, useState } from 'react';
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MarkerType,
    useNodesInitialized,
    useReactFlow,
    type Connection,
    type Edge,
} from '@xyflow/react';
import { Cable, FolderOpen, Play, Plus, Save, Trash2, X } from 'lucide-react';
import type { JsonValue, ModuleInfo } from '../../shared/studio';
import {
    ancestorPath,
    checkConnection,
    collectModuleKeys,
    connectionCompatibility,
    hasPointer,
    nodePorts,
    parsePatch,
    resolveOutputType,
    runPatch,
    withConnection,
    type Patch,
    type PatchConnection,
    type PatchNode,
    type PatchRuntime,
} from './engine';
import {
    initialArguments,
    modulePorts,
    object,
    readPointer,
    resolveSchema,
    schemaLabel,
    standaloneSchema,
    type SchemaPort,
    type ValueType,
} from './schema';
import { SchemaValueEditor } from './SchemaValueEditor';
import {
    displayModuleName,
    nodeTypes,
    patchNodeLabel,
    type FlowPatchNode,
} from './PatchNodeCard';
import { clauseTrampolinePatch } from './demo';
import '@xyflow/react/dist/style.css';
import './patching.css';

export interface PatchCanvasProps extends PatchRuntime {
    modules: ModuleInfo[];
    context: JsonValue;
    onResult?: (value: JsonValue, name: string, contract: boolean) => void;
    onInvalidate?: () => void;
    onContextChange?: (context: JsonValue) => void;
    onLoadModules?: (keys: string[]) => Promise<void>;
    onDiscoverModules?: () => Promise<void>;
    addModule?: { key: string; sequence: number } | null;
    example?: {
        clauseKey: string;
        trampolineKey: string;
        sequence: number;
    } | null;
}
const emptyPatch = (): Patch => ({
    version: 2,
    nodes: [],
    connections: [],
    outputs: [],
    output: null,
});
const errorText = (error: unknown) =>
    error instanceof Error ? error.message : String(error);
const valueOf = (node: PatchNode) =>
    node.kind === 'variable'
        ? node.value
        : node.kind === 'parameter'
          ? node.default
          : node.arguments;
function replaceValue(
    node: PatchNode,
    value: JsonValue | undefined,
): PatchNode {
    return node.kind === 'variable'
        ? { ...node, value }
        : node.kind === 'parameter'
          ? { ...node, default: value }
          : { ...node, arguments: value };
}
function graphAt(root: Patch, path: string[]): Patch {
    let graph = root;
    for (const id of path) {
        const node = graph.nodes.find((node) => node.id === id);
        if (node?.kind !== 'subpatch')
            throw new Error('This reusable patch no longer exists.');
        graph = node.patch;
    }
    return graph;
}
function replaceGraph(root: Patch, path: string[], next: Patch): Patch {
    if (!path.length) return next;
    return {
        ...root,
        nodes: root.nodes.map((node) =>
            node.id === path[0] && node.kind === 'subpatch'
                ? {
                      ...node,
                      patch: replaceGraph(node.patch, path.slice(1), next),
                  }
                : node,
        ),
    };
}
function isContract(type: ValueType | undefined): boolean {
    if (!type) return false;
    const schema = resolveSchema(type.schema, type.root ?? type.schema);
    return object(schema) && schema['x-sapio-role'] === 'contract';
}
function withoutNodes(patch: Patch, removed: Set<string>): Patch {
    const outputs = patch.outputs.filter((output) => !removed.has(output.node));
    return {
        ...patch,
        nodes: patch.nodes.filter((node) => !removed.has(node.id)),
        connections: patch.connections.filter(
            (edge) => !removed.has(edge.source) && !removed.has(edge.target),
        ),
        outputs,
        output: outputs.some((output) => output.name === patch.output)
            ? patch.output
            : (outputs[0]?.name ?? null),
    };
}

function FitPatchView({ identity }: { identity: string }) {
    const initialized = useNodesInitialized();
    const { fitView } = useReactFlow();
    useEffect(() => {
        if (initialized) void fitView({ padding: 0.15, maxZoom: 1 });
    }, [identity, initialized, fitView]);
    return null;
}

export function PatchCanvas(props: PatchCanvasProps) {
    const {
        modules,
        context,
        onResult,
        onInvalidate,
        onContextChange,
        onLoadModules,
        onDiscoverModules,
        addModule,
        example,
    } = props;
    const [root, setRoot] = useState<Patch>(emptyPatch);
    const [path, setPath] = useState<string[]>([]);
    const patch = graphAt(root, path);
    const latestRoot = useRef(root);
    latestRoot.current = root;
    const [drag, setDrag] = useState<{
        node: string;
        handle: string;
        side: 'source' | 'target';
    } | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [callables, setCallables] = useState<Set<string>>(new Set());
    const [status, setStatus] = useState<
        Record<string, 'running' | 'complete'>
    >({});
    const [message, setMessage] = useState('');
    const [running, setRunning] = useState(false);
    const [discovering, setDiscovering] = useState(false);
    const [result, setResult] = useState<JsonValue | undefined>();
    const [invalid, setInvalid] = useState<Set<string>>(new Set());
    const [moduleChoice, setModuleChoice] = useState('');
    const [variableType, setVariableType] = useState('0');
    const [addingVariable, setAddingVariable] = useState(false);
    const [sourcePicker, setSourcePicker] = useState<{
        node: string;
        path: string;
    } | null>(null);
    const [outputName, setOutputName] = useState('result');
    const [outputPath, setOutputPath] = useState('');
    const lastAdded = useRef<number | null>(null);
    const lastExample = useRef<number | undefined>(undefined);
    const nextId = useRef(0);
    const invalidDrafts = useRef(new Set<string>());
    const revision = useRef(0);
    const selectedNode = patch.nodes.find((node) => node.id === selected);
    const selectedType =
        selectedNode &&
        (selectedNode.kind === 'variable' || selectedNode.kind === 'parameter'
            ? selectedNode.type
            : nodePorts(selectedNode, modules, 'arguments')[0]);
    const outputs = selectedNode
        ? nodePorts(selectedNode, modules, 'returns')
        : [];
    const designated = patch.outputs.find(
        (output) => output.name === patch.output,
    );
    const contractOutput = isContract(
        designated && resolveOutputType(patch, designated, modules),
    );
    const nameOf = (node: PatchNode) => patchNodeLabel(node, modules);
    const id = (prefix: string) =>
        `${prefix}-${Date.now()}-${nextId.current++}`;
    function clearResult() {
        revision.current++;
        setResult(undefined);
        setStatus({});
        onInvalidate?.();
    }
    function change(next: Patch, semantic = true) {
        setRoot((current) => replaceGraph(current, path, next));
        if (semantic) clearResult();
    }
    function canNavigate() {
        if (!invalidDrafts.current.size) return true;
        setMessage(
            'Finish the invalid field or discard the unfinished draft before leaving this node.',
        );
        return false;
    }
    function choose(node: string | null) {
        if (!canNavigate()) return false;
        setSelected(node);
        setSelectedEdge(null);
        setSourcePicker(null);
        setOutputPath('');
        return true;
    }
    function updateNode(node: PatchNode, semantic = true) {
        change(
            {
                ...patch,
                nodes: patch.nodes.map((item) =>
                    item.id === node.id ? node : item,
                ),
            },
            semantic,
        );
    }
    function position() {
        return {
            x: 60 + (patch.nodes.length % 3) * 380,
            y: 60 + Math.floor(patch.nodes.length / 3) * 290,
        };
    }
    function moduleNode(module: ModuleInfo): PatchNode {
        return {
            id: id('module'),
            kind: 'module',
            moduleKey: module.key,
            arguments: initialArguments(module),
            position: position(),
        };
    }
    function add(key: string) {
        if (!canNavigate()) return;
        const module = modules.find((item) => item.key === key);
        if (!module) return;
        const node = moduleNode(module);
        let next = { ...patch, nodes: [...patch.nodes, node] };
        if (!next.output || isContract(modulePorts(module, 'returns')[0])) {
            const name = isContract(modulePorts(module, 'returns')[0])
                ? 'contract'
                : 'result';
            next = {
                ...next,
                outputs: [
                    ...next.outputs.filter((output) => output.name !== name),
                    { name, node: node.id, path: '' },
                ],
                output: name,
            };
        }
        change(next);
        choose(node.id);
        setAddingVariable(false);
        setMessage('Configure the inputs, then build the named patch output.');
    }
    useEffect(() => {
        if (addModule && lastAdded.current !== addModule.sequence) {
            lastAdded.current = addModule.sequence;
            add(addModule.key);
        }
        // A sequence represents an explicit user action.
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
        if (!canNavigate()) return;
        const sample = clauseTrampolinePatch(provider, caller);
        setRoot(sample);
        setPath([]);
        choose('trampoline');
        clearResult();
        onContextChange?.(sample.context);
        setMessage(
            'Alice and Bob are values. The dashed wire supplies a callable implementation. Build the policy output.',
        );
    }, [example, modules, onContextChange]);
    useEffect(() => {
        clearResult();
    }, [context]);

    async function discover() {
        if (!onDiscoverModules || discovering) return;
        setDiscovering(true);
        try {
            await onDiscoverModules();
        } catch (error) {
            setMessage(errorText(error));
        } finally {
            setDiscovering(false);
        }
    }
    function configure(node: string, input: string) {
        if (!choose(node)) return;
        setSourcePicker({ node, path: input });
        setAddingVariable(false);
        void discover();
    }
    function wire(edge: PatchConnection, graph = patch) {
        if (!canNavigate()) return;
        try {
            change(withConnection(graph, modules, edge));
            setSourcePicker(null);
            setMessage(
                'Connected. This input now uses the wire; disconnecting leaves it unset.',
            );
        } catch (error) {
            setMessage(errorText(error));
        }
    }
    function disconnect(node: string, input: string) {
        change({
            ...patch,
            connections: patch.connections.filter(
                (edge) =>
                    edge.target !== node ||
                    !ancestorPath(edge.targetPath, input),
            ),
        });
        setMessage('Disconnected. Set a value or choose another source.');
    }
    function createVariable(
        type: ValueType,
        name = 'Variable',
        value?: JsonValue,
        target?: { node: string; path: string },
    ) {
        if (!canNavigate()) return;
        const node: PatchNode = {
            kind: 'variable',
            id: id('variable'),
            name,
            type: { schema: standaloneSchema(type) },
            value,
            position: target
                ? {
                      x: Math.max(
                          0,
                          (patch.nodes.find((node) => node.id === target.node)
                              ?.position.x ?? 420) - 380,
                      ),
                      y:
                          (patch.nodes.find((node) => node.id === target.node)
                              ?.position.y ?? 60) + 80,
                  }
                : position(),
        };
        let next: Patch = { ...patch, nodes: [...patch.nodes, node] };
        try {
            if (target)
                next = withConnection(next, modules, {
                    id: id('wire'),
                    kind: 'value',
                    source: node.id,
                    sourcePath: '',
                    target: target.node,
                    targetPath: target.path,
                });
            if (!next.output)
                next = {
                    ...next,
                    outputs: [{ name: 'value', node: node.id, path: '' }],
                    output: 'value',
                };
            change(next);
            choose(node.id);
            setAddingVariable(false);
        } catch (error) {
            setMessage(errorText(error));
        }
    }
    function asEdge(input: Connection | Edge): PatchConnection | null {
        if (
            !input.source ||
            !input.target ||
            !input.targetHandle?.startsWith('input:') ||
            (input.sourceHandle !== 'module' &&
                !input.sourceHandle?.startsWith('value:'))
        )
            return null;
        return {
            id: 'pending-wire',
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
    function dragCompatible(
        node: string,
        handle: string,
        side: 'source' | 'target',
    ): boolean {
        if (!drag || drag.side === side) return false;
        const source = side === 'source' ? { node, handle } : drag;
        const target = side === 'target' ? { node, handle } : drag;
        const edge = asEdge({
            source: source.node,
            sourceHandle: source.handle,
            target: target.node,
            targetHandle: target.handle,
        });
        return !!edge && checkConnection(patch, modules, edge) === null;
    }
    const flowNodes: FlowPatchNode[] = patch.nodes.map((node) => ({
        id: node.id,
        type: 'patch',
        position: node.position,
        selected: !selectedEdge && node.id === selected,
        ariaLabel: `${nameOf(node)} ${node.kind}`,
        data: {
            patchNode: node,
            modules,
            connectionPending: drag !== null,
            compatibleInputs: drag
                ? nodePorts(node, modules, 'arguments')
                      .filter((port) =>
                          dragCompatible(
                              node.id,
                              `input:${port.path}`,
                              'target',
                          ),
                      )
                      .map((port) => port.path)
                : [],
            compatibleOutputs: drag
                ? nodePorts(node, modules, 'returns')
                      .filter((port) =>
                          dragCompatible(
                              node.id,
                              `value:${port.path}`,
                              'source',
                          ),
                      )
                      .map((port) => port.path)
                : [],
            compatibleCallable: dragCompatible(node.id, 'module', 'source'),
            expanded: expanded.has(node.id),
            showCallable:
                callables.has(node.id) ||
                patch.connections.some(
                    (edge) => edge.source === node.id && edge.kind === 'module',
                ),
            status: status[node.id],
            inputSources: Object.fromEntries(
                patch.connections
                    .filter((edge) => edge.target === node.id)
                    .map((edge) => [
                        edge.targetPath,
                        nameOf(
                            patch.nodes.find(
                                (item) => item.id === edge.source,
                            )!,
                        ),
                    ]),
            ),
            connectedInputs: patch.connections
                .filter((edge) => edge.target === node.id)
                .map((edge) => edge.targetPath),
            connectedOutputs: patch.connections
                .filter(
                    (edge) => edge.source === node.id && edge.kind === 'value',
                )
                .map((edge) => edge.sourcePath),
            onExpand: () =>
                setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                }),
            onShowCallable: () =>
                setCallables((current) => new Set(current).add(node.id)),
            onInput: (input) => configure(node.id, input),
        },
    }));
    const flowEdges: Edge[] = patch.connections.map((edge) => {
        const input = nodePorts(
            patch.nodes.find((node) => node.id === edge.target)!,
            modules,
            'arguments',
        ).find((port) => port.path === edge.targetPath);
        return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle:
                edge.kind === 'module' ? 'module' : `value:${edge.sourcePath}`,
            targetHandle: `input:${edge.targetPath}`,
            type: 'smoothstep',
            label:
                edge.kind === 'module' ? 'Callable' : (input?.label ?? 'Value'),
            ariaLabel:
                edge.kind === 'module'
                    ? 'Callable module connection'
                    : `Value connection to ${input?.label ?? 'input'}`,
            selected: edge.id === selectedEdge,
            style: {
                stroke: edge.kind === 'module' ? '#aa7937' : '#287c73',
                strokeDasharray: edge.kind === 'module' ? '5 4' : undefined,
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: edge.kind === 'module' ? '#aa7937' : '#287c73',
            },
        };
    });
    async function run(output: string | null = null) {
        if (running || invalid.size) return;
        setRunning(true);
        clearResult();
        setMessage('Validating and evaluating the patch…');
        const currentRevision = revision.current;
        try {
            const completed = await runPatch(
                patch,
                modules,
                output,
                context,
                props,
                (progress) => {
                    if (revision.current === currentRevision)
                        setStatus((current) => ({
                            ...current,
                            [progress.node]: progress.state,
                        }));
                },
            );
            if (currentRevision !== revision.current) {
                setMessage(
                    'Inputs changed during evaluation. Build again to use the current values.',
                );
                return;
            }
            const node = patch.nodes.find((node) => node.id === output);
            const type = node
                ? nodePorts(node, modules, 'returns')[0]
                : designated && resolveOutputType(patch, designated, modules);
            setResult(completed.output);
            onResult?.(
                completed.output,
                node ? nameOf(node) : (designated?.name ?? 'Patch output'),
                isContract(type),
            );
            setMessage(
                `Evaluated ${node ? nameOf(node) : (designated?.name ?? 'output')}. ${completed.executed.length} module calls completed.`,
            );
        } catch (error) {
            if (currentRevision === revision.current)
                setMessage(errorText(error));
        } finally {
            setRunning(false);
        }
    }
    async function save() {
        try {
            if (!window.studio)
                throw new Error('Saving requires the desktop app.');
            const text = JSON.stringify({ ...patch, context }, null, 2);
            parsePatch(text);
            await window.studio.documents.save({
                kind: 'json',
                name: path.length ? 'reusable.patch.json' : 'patch.sapio.json',
                text,
            });
            setMessage(
                'Saved patch with its named interface and exact module hashes.',
            );
        } catch (error) {
            setMessage(errorText(error));
        }
    }
    async function open(reuse = false) {
        if (!canNavigate()) return;
        const openedRevision = revision.current;
        const openedRoot = root;
        try {
            if (!window.studio)
                throw new Error('Opening requires the desktop app.');
            const document = await window.studio.documents.open('json');
            if (!document) return;
            const imported = parsePatch(document.text);
            const keys = collectModuleKeys(imported);
            setMessage('Loading the patch’s exact module interfaces…');
            await onLoadModules?.(keys);
            if (!canNavigate()) return;
            if (
                revision.current !== openedRevision ||
                latestRoot.current !== openedRoot
            )
                throw new Error(
                    'The patch changed while opening the file. Open it again to keep your latest edits.',
                );
            const { context: importedContext, ...graph } = imported;
            if (reuse) {
                const node: PatchNode = {
                    kind: 'subpatch',
                    id: id('patch'),
                    name: document.name.replace(
                        /\.(patch|sapio)?\.?json$/u,
                        '',
                    ),
                    patch: graph,
                    arguments: {},
                    position: position(),
                };
                change({ ...patch, nodes: [...patch.nodes, node] });
                choose(node.id);
                setMessage(
                    'Imported reusable patch. It inherits this patch’s network, amount and lowering.',
                );
            } else {
                if (onContextChange) onContextChange(importedContext);
                else if (
                    JSON.stringify(importedContext) !== JSON.stringify(context)
                )
                    throw new Error(
                        'This patch needs a different execution context.',
                    );
                setRoot(graph);
                setPath([]);
                choose(null);
                clearResult();
                setInvalid(new Set());
                setMessage(
                    `Opened ${document.name}. Choose a node to edit, or build the named output.`,
                );
            }
        } catch (error) {
            setMessage(errorText(error));
        }
    }
    function removeSelected() {
        invalidDrafts.current.clear();
        setInvalid(new Set());
        if (selectedEdge)
            change({
                ...patch,
                connections: patch.connections.filter(
                    (edge) => edge.id !== selectedEdge,
                ),
            });
        else if (selected) change(withoutNodes(patch, new Set([selected])));
        choose(null);
    }
    function declareOutput() {
        if (
            !selectedNode ||
            !outputName.trim() ||
            !outputs.some((port) => port.path === outputPath)
        )
            return;
        const name = outputName.trim();
        change({
            ...patch,
            outputs: [
                ...patch.outputs.filter((output) => output.name !== name),
                { name, node: selectedNode.id, path: outputPath },
            ],
            output: name,
        });
        setMessage(
            `The main build now evaluates “${name}”, regardless of the selected node.`,
        );
    }
    const sourceTarget =
        sourcePicker &&
        patch.nodes.find((node) => node.id === sourcePicker.node);
    const sourcePort =
        sourceTarget &&
        nodePorts(sourceTarget, modules, 'arguments').find(
            (port) => port.path === sourcePicker?.path,
        );
    const sourceEdge =
        sourcePicker &&
        patch.connections.find(
            (edge) =>
                edge.target === sourcePicker.node &&
                ancestorPath(edge.targetPath, sourcePicker.path),
        );
    const sources = Object.fromEntries(
        patch.connections
            .filter((edge) => edge.target === selectedNode?.id)
            .map((edge) => {
                const node = patch.nodes.find(
                    (node) => node.id === edge.source,
                )!;
                return [
                    edge.targetPath,
                    { label: nameOf(node), onNavigate: () => choose(node.id) },
                ];
            }),
    );
    const typeChoices: { name: string; type: ValueType }[] = [
        { name: 'Text', type: { schema: { type: 'string', title: 'Text' } } },
        {
            name: 'Whole number',
            type: { schema: { type: 'integer', title: 'Whole number' } },
        },
        {
            name: 'Boolean',
            type: { schema: { type: 'boolean', title: 'Boolean' } },
        },
        { name: 'JSON value', type: { schema: true } },
    ];
    const typeNames = new Set(typeChoices.map((choice) => choice.name));
    for (const module of modules)
        for (const port of [
            ...modulePorts(module, 'arguments'),
            ...modulePorts(module, 'returns'),
        ]) {
            const name = schemaLabel(port);
            if (
                port.kind === 'module' ||
                typeNames.has(name) ||
                name === 'object' ||
                name === 'any value'
            )
                continue;
            typeNames.add(name);
            typeChoices.push({
                name,
                type: { schema: port.schema, root: port.root },
            });
        }
    const candidates: {
        node: PatchNode;
        port?: SchemaPort;
        edge: PatchConnection;
        reason: string;
        compatible: boolean;
        producer: boolean;
    }[] = [];
    if (sourcePicker && sourcePort) {
        const addCandidates = (node: PatchNode, producer: boolean) => {
            if (node.id === sourcePicker.node) return;
            const ports: (SchemaPort | undefined)[] = nodePorts(
                node,
                modules,
                'returns',
            ).filter((port) => port.kind === sourcePort.kind);
            if (sourcePort.kind === 'module' && node.kind === 'module')
                ports.unshift(undefined);
            for (const port of ports) {
                const edge: PatchConnection = {
                    id: 'candidate-wire',
                    kind: port ? 'value' : 'module',
                    source: node.id,
                    sourcePath: port?.path ?? '',
                    target: sourcePicker.node,
                    targetPath: sourcePicker.path,
                };
                const graph = producer
                    ? { ...patch, nodes: [...patch.nodes, node] }
                    : patch;
                const compatibility = connectionCompatibility(
                    graph,
                    modules,
                    edge,
                );
                const conflict = compatibility.compatible
                    ? checkConnection(graph, modules, edge)
                    : null;
                candidates.push({
                    node,
                    port,
                    edge,
                    reason: conflict ?? compatibility.reason,
                    compatible: compatibility.compatible && !conflict,
                    producer,
                });
            }
        };
        for (const node of patch.nodes) addCandidates(node, false);
        for (const module of modules)
            addCandidates(
                {
                    kind: 'module',
                    id: `producer-${module.key}`,
                    moduleKey: module.key,
                    arguments: initialArguments(module),
                    position: position(),
                },
                true,
            );
    }
    function useCandidate(candidate: (typeof candidates)[number]) {
        const node = candidate.producer
            ? { ...candidate.node, id: id('module') }
            : candidate.node;
        wire(
            { ...candidate.edge, id: id('wire'), source: node.id },
            candidate.producer
                ? { ...patch, nodes: [...patch.nodes, node] }
                : patch,
        );
    }
    return (
        <section className="patch-workspace" aria-label="Visual module patch">
            <div className="patch-toolbar">
                <div className="patch-add-control">
                    <button
                        onClick={() => {
                            if (!choose(null)) return;
                            setAddingVariable(true);
                            void discover();
                        }}
                        disabled={running}
                    >
                        <Plus size={14} /> Add Variable
                    </button>
                    <select
                        aria-label="Module to add"
                        value={moduleChoice}
                        onFocus={() => void discover()}
                        onChange={(event) =>
                            setModuleChoice(event.target.value)
                        }
                    >
                        <option value="">Choose a module</option>
                        {modules.map((module) => (
                            <option value={module.key} key={module.key}>
                                {displayModuleName(module)}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => add(moduleChoice)}
                        disabled={!moduleChoice || running}
                    >
                        <Plus size={14} /> Add module
                    </button>
                </div>
                <div className="patch-toolbar-right">
                    <button onClick={() => void open()} disabled={running}>
                        <FolderOpen size={14} /> Open patch
                    </button>
                    <button onClick={() => void open(true)} disabled={running}>
                        Import reusable patch
                    </button>
                    <button
                        onClick={save}
                        disabled={
                            !patch.nodes.length || running || !!invalid.size
                        }
                    >
                        <Save size={14} /> Save
                    </button>
                    <button
                        onClick={removeSelected}
                        disabled={(!selected && !selectedEdge) || running}
                        aria-label="Remove selected node or connection"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            <div className="patch-output-bar">
                <nav aria-label="Patch definition">
                    <button
                        onClick={() => {
                            if (!choose(null)) return;
                            setPath([]);
                            clearResult();
                        }}
                    >
                        Main patch
                    </button>
                    {path.map((entry, index) => (
                        <button
                            key={entry}
                            onClick={() => {
                                if (!choose(null)) return;
                                setPath(path.slice(0, index + 1));
                                clearResult();
                            }}
                        >
                            {' '}
                            /{' '}
                            {graphAt(root, path.slice(0, index)).nodes.find(
                                (node) => node.id === entry,
                            )?.label ?? 'Reusable patch'}
                        </button>
                    ))}
                </nav>
                <label>
                    Patch output{' '}
                    <select
                        aria-label="Patch output"
                        value={patch.output ?? ''}
                        onChange={(event) =>
                            change({
                                ...patch,
                                output: event.target.value || null,
                            })
                        }
                    >
                        <option value="">Choose an output</option>
                        {patch.outputs.map((output) => (
                            <option key={output.name} value={output.name}>
                                {output.name}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    className="patch-run"
                    onClick={() => void run()}
                    disabled={!designated || running || !!invalid.size}
                >
                    <Play size={14} />{' '}
                    {running
                        ? 'Evaluating…'
                        : contractOutput
                          ? 'Compile contract'
                          : 'Build output'}
                </button>
            </div>
            <div className="patch-stage">
                <div className="patch-flow">
                    <ReactFlow<FlowPatchNode>
                        nodes={flowNodes}
                        edges={flowEdges}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ maxZoom: 1, padding: 0.15 }}
                        minZoom={0.15}
                        maxZoom={1.5}
                        nodesDraggable={!running}
                        nodesConnectable={!running}
                        deleteKeyCode={running ? null : ['Backspace', 'Delete']}
                        multiSelectionKeyCode={null}
                        onConnectStart={(_, params) => {
                            if (
                                params.nodeId &&
                                params.handleId &&
                                params.handleType
                            )
                                setDrag({
                                    node: params.nodeId,
                                    handle: params.handleId,
                                    side: params.handleType,
                                });
                        }}
                        onConnectEnd={() => setDrag(null)}
                        onNodeClick={(event, node) => {
                            if (
                                event.target instanceof Element &&
                                event.target.closest('button')
                            )
                                return;
                            if (choose(node.id)) setAddingVariable(false);
                        }}
                        onEdgeClick={(_, edge) => {
                            if (choose(null)) setSelectedEdge(edge.id);
                        }}
                        onPaneClick={() => choose(null)}
                        onNodesChange={(changes) => {
                            const selection = changes.find(
                                (change) =>
                                    change.type === 'select' && change.selected,
                            );
                            if (selection?.type === 'select' && canNavigate()) {
                                setSelected(selection.id);
                                setSelectedEdge(null);
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
                                change(withoutNodes(patch, removed));
                                if (selected && removed.has(selected))
                                    choose(null);
                                return;
                            }
                            const positions = changes.filter(
                                (item) =>
                                    item.type === 'position' && item.position,
                            );
                            if (positions.length)
                                change(
                                    {
                                        ...patch,
                                        nodes: patch.nodes.map((node) => {
                                            const moved = positions.find(
                                                (item) =>
                                                    item.type === 'position' &&
                                                    item.id === node.id,
                                            );
                                            return moved?.type === 'position' &&
                                                moved.position
                                                ? {
                                                      ...node,
                                                      position: moved.position,
                                                  }
                                                : node;
                                        }),
                                    },
                                    false,
                                );
                        }}
                        onEdgesChange={(changes) => {
                            const selection = changes.find(
                                (change) =>
                                    change.type === 'select' && change.selected,
                            );
                            if (selection?.type === 'select' && canNavigate()) {
                                setSelected(null);
                                setSelectedEdge(selection.id);
                            }
                            if (running) return;
                            const removed = new Set(
                                changes
                                    .filter(
                                        (change) => change.type === 'remove',
                                    )
                                    .map((change) => change.id),
                            );
                            if (removed.size)
                                change({
                                    ...patch,
                                    connections: patch.connections.filter(
                                        (edge) => !removed.has(edge.id),
                                    ),
                                });
                        }}
                        isValidConnection={(input) => {
                            const edge = asEdge(input);
                            return (
                                !!edge &&
                                checkConnection(patch, modules, edge) === null
                            );
                        }}
                        onConnect={(input) => {
                            const edge = asEdge(input);
                            if (edge) wire({ ...edge, id: id('wire') });
                        }}
                    >
                        <FitPatchView
                            identity={`${path.join('/')}:${patch.nodes.map((node) => node.id).join(',')}`}
                        />
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={20}
                            size={1}
                            color="#b7c2b0"
                        />
                        <Controls showInteractive={false} />
                    </ReactFlow>
                    {!patch.nodes.length && (
                        <div className="patch-empty">
                            <span className="patch-empty-icon">
                                <Cable size={28} />
                            </span>
                            <h2>Give your custody program a shape.</h2>
                            <p>
                                Start with a contract module. Click an input to
                                enter a value, create a matching Variable, or
                                find a compatible building block.
                            </p>
                            <div className="patch-legend">
                                <span>
                                    <i /> Values
                                </span>
                                <span>
                                    <i className="reference" /> Callable modules
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                {(selectedNode || addingVariable) && (
                    <aside
                        className="patch-inspector"
                        aria-label="Node inspector"
                    >
                        <header>
                            <div>
                                <small>
                                    {addingVariable
                                        ? 'NEW VALUE'
                                        : selectedNode?.kind.toUpperCase()}
                                </small>
                                <h3>
                                    {addingVariable
                                        ? 'Add Variable'
                                        : selectedNode && nameOf(selectedNode)}
                                </h3>
                            </div>
                            <button
                                aria-label="Close inspector"
                                onClick={() => {
                                    if (choose(null)) setAddingVariable(false);
                                }}
                            >
                                <X size={16} />
                            </button>
                        </header>
                        {addingVariable ? (
                            <>
                                <p className="patch-inspector-description">
                                    Variables hold named values you can reuse.
                                    Creating one from an input automatically
                                    gives it the matching type.
                                </p>
                                <label>
                                    Variable type
                                    <select
                                        aria-label="Variable type"
                                        value={variableType}
                                        onChange={(event) =>
                                            setVariableType(event.target.value)
                                        }
                                    >
                                        {typeChoices.map((choice, index) => (
                                            <option key={index} value={index}>
                                                {choice.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <button
                                    onClick={() => {
                                        const choice =
                                            typeChoices[Number(variableType)];
                                        if (choice) createVariable(choice.type);
                                    }}
                                >
                                    Create Variable
                                </button>
                                {discovering && (
                                    <p role="status">
                                        Reading available types…
                                    </p>
                                )}
                            </>
                        ) : (
                            selectedNode && (
                                <>
                                    <label>
                                        Node name
                                        <input
                                            aria-label="Node name"
                                            value={
                                                selectedNode.label ??
                                                nameOf(selectedNode)
                                            }
                                            disabled={running}
                                            onChange={(event) =>
                                                updateNode(
                                                    {
                                                        ...selectedNode,
                                                        label: event.target
                                                            .value,
                                                    },
                                                    false,
                                                )
                                            }
                                        />
                                    </label>
                                    {selectedNode.kind === 'subpatch' && (
                                        <>
                                            <p className="patch-context-note">
                                                This instance inherits the
                                                parent execution context. Its
                                                inputs override the definition’s
                                                parameter defaults.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    if (!choose(null)) return;
                                                    setPath([
                                                        ...path,
                                                        selectedNode.id,
                                                    ]);
                                                    clearResult();
                                                }}
                                            >
                                                Edit definition
                                            </button>
                                        </>
                                    )}
                                    {sourcePort &&
                                        sourceTarget &&
                                        sourcePicker && (
                                            <section
                                                className="patch-source-picker"
                                                aria-label="Choose input source"
                                            >
                                                <header>
                                                    <h4>
                                                        {sourcePort.label} ·{' '}
                                                        {schemaLabel(
                                                            sourcePort,
                                                        )}
                                                    </h4>
                                                    <button
                                                        aria-label="Close source picker"
                                                        onClick={() =>
                                                            setSourcePicker(
                                                                null,
                                                            )
                                                        }
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                </header>
                                                {sourceEdge ? (
                                                    <>
                                                        <p>
                                                            This input is
                                                            supplied by{' '}
                                                            {nameOf(
                                                                patch.nodes.find(
                                                                    (node) =>
                                                                        node.id ===
                                                                        sourceEdge.source,
                                                                )!,
                                                            )}
                                                            .
                                                        </p>
                                                        <button
                                                            onClick={() =>
                                                                disconnect(
                                                                    sourcePicker.node,
                                                                    sourcePicker.path,
                                                                )
                                                            }
                                                        >
                                                            Disconnect source
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {sourcePort.kind ===
                                                            'value' && (
                                                            <>
                                                                <button
                                                                    onClick={() =>
                                                                        setSourcePicker(
                                                                            null,
                                                                        )
                                                                    }
                                                                >
                                                                    Enter a
                                                                    value below
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        createVariable(
                                                                            sourcePort,
                                                                            sourcePort.label,
                                                                            hasPointer(
                                                                                valueOf(
                                                                                    sourceTarget,
                                                                                ),
                                                                                sourcePort.path,
                                                                            )
                                                                                ? readPointer(
                                                                                      valueOf(
                                                                                          sourceTarget,
                                                                                      )!,
                                                                                      sourcePort.path,
                                                                                  )
                                                                                : undefined,
                                                                            sourcePicker,
                                                                        )
                                                                    }
                                                                >
                                                                    Create
                                                                    matching
                                                                    Variable
                                                                </button>
                                                            </>
                                                        )}
                                                        <h5>
                                                            Compatible sources
                                                        </h5>
                                                        {candidates
                                                            .filter(
                                                                (candidate) =>
                                                                    candidate.compatible &&
                                                                    !candidate.producer,
                                                            )
                                                            .map(
                                                                (candidate) => (
                                                                    <button
                                                                        key={`${candidate.node.id}:${candidate.edge.kind}:${candidate.edge.sourcePath}`}
                                                                        title={
                                                                            candidate.reason
                                                                        }
                                                                        onClick={() =>
                                                                            useCandidate(
                                                                                candidate,
                                                                            )
                                                                        }
                                                                    >
                                                                        {nameOf(
                                                                            candidate.node,
                                                                        )}
                                                                        {candidate
                                                                            .port
                                                                            ?.path
                                                                            ? ` · ${candidate.port.label}`
                                                                            : candidate
                                                                                    .edge
                                                                                    .kind ===
                                                                                'module'
                                                                              ? ' · callable implementation'
                                                                              : ''}
                                                                        <small>
                                                                            {
                                                                                candidate.reason
                                                                            }
                                                                        </small>
                                                                    </button>
                                                                ),
                                                            )}
                                                        <h5>Building blocks</h5>
                                                        {discovering && (
                                                            <p role="status">
                                                                Reading module
                                                                interfaces…
                                                            </p>
                                                        )}
                                                        {candidates
                                                            .filter(
                                                                (candidate) =>
                                                                    candidate.compatible &&
                                                                    candidate.producer,
                                                            )
                                                            .map(
                                                                (candidate) => (
                                                                    <button
                                                                        key={`${candidate.node.id}:${candidate.edge.kind}:${candidate.edge.sourcePath}`}
                                                                        title={
                                                                            candidate.reason
                                                                        }
                                                                        onClick={() =>
                                                                            useCandidate(
                                                                                candidate,
                                                                            )
                                                                        }
                                                                    >
                                                                        Add{' '}
                                                                        {nameOf(
                                                                            candidate.node,
                                                                        )}
                                                                        {candidate
                                                                            .port
                                                                            ?.path
                                                                            ? ` · ${candidate.port.label}`
                                                                            : candidate
                                                                                    .edge
                                                                                    .kind ===
                                                                                'module'
                                                                              ? ' · callable implementation'
                                                                              : ''}
                                                                        <small>
                                                                            {
                                                                                candidate.reason
                                                                            }
                                                                        </small>
                                                                    </button>
                                                                ),
                                                            )}
                                                        <details>
                                                            <summary>
                                                                Why other
                                                                sources do not
                                                                fit
                                                            </summary>
                                                            {candidates
                                                                .filter(
                                                                    (
                                                                        candidate,
                                                                    ) =>
                                                                        !candidate.compatible &&
                                                                        !candidate.producer,
                                                                )
                                                                .map(
                                                                    (
                                                                        candidate,
                                                                    ) => (
                                                                        <p
                                                                            key={`${candidate.node.id}:${candidate.edge.kind}:${candidate.edge.sourcePath}`}
                                                                        >
                                                                            <strong>
                                                                                {nameOf(
                                                                                    candidate.node,
                                                                                )}
                                                                                {candidate
                                                                                    .port
                                                                                    ?.path
                                                                                    ? ` · ${candidate.port.label}`
                                                                                    : candidate
                                                                                            .edge
                                                                                            .kind ===
                                                                                        'module'
                                                                                      ? ' · callable implementation'
                                                                                      : ''}
                                                                            </strong>
                                                                            :{' '}
                                                                            {
                                                                                candidate.reason
                                                                            }
                                                                        </p>
                                                                    ),
                                                                )}
                                                        </details>
                                                    </>
                                                )}
                                            </section>
                                        )}
                                    {selectedType && (
                                        <fieldset
                                            disabled={running}
                                            className="patch-editor-fields"
                                        >
                                            <SchemaValueEditor
                                                key={`${path.join('/')}/${selectedNode.id}`}
                                                schema={selectedType.schema}
                                                rootSchema={selectedType.root}
                                                value={valueOf(selectedNode)}
                                                label={
                                                    selectedNode.kind ===
                                                    'variable'
                                                        ? 'Value'
                                                        : selectedNode.kind ===
                                                            'parameter'
                                                          ? 'Default value'
                                                          : 'Inputs'
                                                }
                                                onChange={(value) =>
                                                    updateNode(
                                                        replaceValue(
                                                            selectedNode,
                                                            value,
                                                        ),
                                                    )
                                                }
                                                sources={sources}
                                                onValidityChange={(
                                                    _,
                                                    valid,
                                                    editorId,
                                                ) => {
                                                    const key = `${selectedNode.id}:${editorId}`;
                                                    const wasInvalid =
                                                        invalidDrafts.current.has(
                                                            key,
                                                        );
                                                    if (valid)
                                                        invalidDrafts.current.delete(
                                                            key,
                                                        );
                                                    else
                                                        invalidDrafts.current.add(
                                                            key,
                                                        );
                                                    if (wasInvalid !== !valid) {
                                                        setInvalid(
                                                            new Set(
                                                                invalidDrafts.current,
                                                            ),
                                                        );
                                                        if (!valid)
                                                            clearResult();
                                                    }
                                                }}
                                                onDisconnect={(input) =>
                                                    disconnect(
                                                        selectedNode.id,
                                                        input,
                                                    )
                                                }
                                                onCreateVariable={
                                                    selectedNode.kind ===
                                                        'module' ||
                                                    selectedNode.kind ===
                                                        'subpatch'
                                                        ? (input, schema) =>
                                                              createVariable(
                                                                  {
                                                                      schema,
                                                                      root:
                                                                          selectedType.root ??
                                                                          selectedType.schema,
                                                                  },
                                                                  nodePorts(
                                                                      selectedNode,
                                                                      modules,
                                                                      'arguments',
                                                                  ).find(
                                                                      (port) =>
                                                                          port.path ===
                                                                          input,
                                                                  )?.label ??
                                                                      'Variable',
                                                                  undefined,
                                                                  {
                                                                      node: selectedNode.id,
                                                                      path: input,
                                                                  },
                                                              )
                                                        : undefined
                                                }
                                                onExtract={
                                                    selectedNode.kind ===
                                                        'module' ||
                                                    selectedNode.kind ===
                                                        'subpatch'
                                                        ? (
                                                              input,
                                                              value,
                                                              schema,
                                                          ) =>
                                                              createVariable(
                                                                  {
                                                                      schema,
                                                                      root:
                                                                          selectedType.root ??
                                                                          selectedType.schema,
                                                                  },
                                                                  nodePorts(
                                                                      selectedNode,
                                                                      modules,
                                                                      'arguments',
                                                                  ).find(
                                                                      (port) =>
                                                                          port.path ===
                                                                          input,
                                                                  )?.label ??
                                                                      'Variable',
                                                                  value,
                                                                  {
                                                                      node: selectedNode.id,
                                                                      path: input,
                                                                  },
                                                              )
                                                        : undefined
                                                }
                                            />
                                        </fieldset>
                                    )}
                                    {(selectedNode.kind === 'variable' ||
                                        selectedNode.kind === 'parameter') && (
                                        <div className="patch-interface-controls">
                                            {selectedNode.kind ===
                                            'parameter' ? (
                                                <>
                                                    <label>
                                                        Parameter name
                                                        <input
                                                            aria-label="Parameter name"
                                                            value={
                                                                selectedNode.name
                                                            }
                                                            onChange={(event) =>
                                                                updateNode({
                                                                    ...selectedNode,
                                                                    name: event
                                                                        .target
                                                                        .value,
                                                                })
                                                            }
                                                        />
                                                    </label>
                                                    <p>
                                                        Callers provide this
                                                        named input. An unset
                                                        default makes it
                                                        required.
                                                    </p>
                                                    <button
                                                        disabled={
                                                            running ||
                                                            !!invalid.size
                                                        }
                                                        onClick={() =>
                                                            updateNode({
                                                                kind: 'variable',
                                                                id: selectedNode.id,
                                                                name: selectedNode.name,
                                                                label: selectedNode.label,
                                                                type: selectedNode.type,
                                                                value: selectedNode.default,
                                                                position:
                                                                    selectedNode.position,
                                                            })
                                                        }
                                                    >
                                                        Make local Variable
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    disabled={
                                                        running ||
                                                        !!invalid.size
                                                    }
                                                    onClick={() => {
                                                        const names = new Set(
                                                            patch.nodes
                                                                .filter(
                                                                    (node) =>
                                                                        node.kind ===
                                                                        'parameter',
                                                                )
                                                                .map(
                                                                    (node) =>
                                                                        node.name,
                                                                ),
                                                        );
                                                        let name =
                                                            selectedNode.label?.trim() ||
                                                            selectedNode.name;
                                                        const base = name;
                                                        let index = 2;
                                                        while (names.has(name))
                                                            name = `${base} ${index++}`;
                                                        updateNode({
                                                            kind: 'parameter',
                                                            id: selectedNode.id,
                                                            label: selectedNode.label,
                                                            position:
                                                                selectedNode.position,
                                                            type: selectedNode.type,
                                                            name,
                                                            default:
                                                                selectedNode.value,
                                                        });
                                                    }}
                                                >
                                                    Expose as parameter
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className="patch-interface-controls">
                                        <button
                                            onClick={() =>
                                                void run(selectedNode.id)
                                            }
                                            disabled={running || !!invalid.size}
                                        >
                                            Evaluate value
                                        </button>
                                        <label>
                                            Output name
                                            <input
                                                aria-label="Output name"
                                                value={outputName}
                                                onChange={(event) =>
                                                    setOutputName(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                        <label>
                                            Output value
                                            <select
                                                aria-label="Output value"
                                                value={outputPath}
                                                onChange={(event) =>
                                                    setOutputPath(
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                {outputs.map((port) => (
                                                    <option
                                                        key={port.path}
                                                        value={port.path}
                                                    >
                                                        {port.label} ·{' '}
                                                        {schemaLabel(port)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <button
                                            disabled={
                                                running || !outputName.trim()
                                            }
                                            onClick={declareOutput}
                                        >
                                            Use as output
                                        </button>
                                    </div>
                                    {patch.outputs.some(
                                        (output) =>
                                            output.node === selectedNode.id,
                                    ) && (
                                        <div className="patch-named-outputs">
                                            {patch.outputs
                                                .filter(
                                                    (output) =>
                                                        output.node ===
                                                        selectedNode.id,
                                                )
                                                .map((output) => (
                                                    <div key={output.name}>
                                                        <span>
                                                            Output:{' '}
                                                            {output.name}
                                                        </span>
                                                        <button
                                                            aria-label={`Remove output ${output.name}`}
                                                            onClick={() => {
                                                                const outputs =
                                                                    patch.outputs.filter(
                                                                        (
                                                                            item,
                                                                        ) =>
                                                                            item.name !==
                                                                            output.name,
                                                                    );
                                                                change({
                                                                    ...patch,
                                                                    outputs,
                                                                    output:
                                                                        patch.output ===
                                                                        output.name
                                                                            ? (outputs[0]
                                                                                  ?.name ??
                                                                              null)
                                                                            : patch.output,
                                                                });
                                                            }}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                    {result !== undefined && (
                                        <details className="patch-result">
                                            <summary>
                                                Inspect evaluated value
                                            </summary>
                                            <pre>
                                                {JSON.stringify(
                                                    result,
                                                    null,
                                                    2,
                                                )}
                                            </pre>
                                        </details>
                                    )}
                                </>
                            )
                        )}
                    </aside>
                )}
            </div>
            <footer className="patch-status" role="status">
                {invalid.size > 0 && (
                    <button
                        onClick={() => {
                            invalidDrafts.current.clear();
                            setInvalid(new Set());
                            setSelected(null);
                            setSourcePicker(null);
                            clearResult();
                            setMessage(
                                'Discarded unfinished edits. The affected fields remain unset.',
                            );
                        }}
                    >
                        Discard unfinished draft
                    </button>
                )}
                <span>
                    {invalid.size
                        ? 'Finish the invalid field before building or saving.'
                        : message ||
                          'Click an input to choose its source. Values flow left to right.'}
                </span>
                <small>
                    {patch.nodes.length} nodes · {patch.connections.length}{' '}
                    connections
                </small>
            </footer>
        </section>
    );
}
