import { useEffect } from 'react';
import {
    Handle,
    Position,
    useUpdateNodeInternals,
    type Node,
    type NodeProps,
} from '@xyflow/react';
import {
    AlertCircle,
    ArrowDownToLine,
    Box,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Component,
    FunctionSquare,
    LoaderCircle,
    Play,
    SlidersHorizontal,
    Variable,
    Vault,
} from 'lucide-react';
import type { JsonValue, ModuleInfo } from '../../shared/studio';
import { type PatchNode } from './engine';
import {
    escapePointer,
    humanize,
    modulePorts,
    object,
    pointerTokens,
    resolveSchema,
    schemaLabel,
    type SchemaPort,
} from './schema';
import './node-card.css';

export interface PatchNodeCardData extends Record<string, unknown> {
    patchNode: PatchNode;
    modules: ModuleInfo[];
    inputs: SchemaPort[];
    outputs: SchemaPort[];
    canBuild: boolean;
    onBuild: () => void;
    expanded: boolean;
    showCallable: boolean;
    status?: 'running' | 'complete';
    inputSources: Record<string, string>;
    connectedInputs: string[];
    connectedOutputs: string[];
    onExpand: () => void;
    onInput: (path: string) => void;
    onShowCallable: () => void;
    availability?: 'ready' | 'missing' | 'invalid';
    message?: string;
    connectionPending?: boolean;
    compatibleInputs?: string[];
    compatibleOutputs?: string[];
    compatibleCallable?: boolean;
    referenceOnly?: boolean;
}

export type FlowPatchNode = Node<PatchNodeCardData, 'patch'>;

/** A collapsed node must retain every handle with a visible connection. */
export function visibleNodePorts(
    ports: SchemaPort[],
    side: 'arguments' | 'returns',
    expanded: boolean,
    connectedPaths: string[],
    referenceOnly = false,
): SchemaPort[] {
    if (expanded) return ports;
    const connected = new Set(connectedPaths);
    const topLevel = ports.some(
        (port) => pointerTokens(port.path).length === 1,
    );
    return ports.filter((port) => {
        if (connected.has(port.path)) return true;
        if (referenceOnly) return false;
        if (side === 'returns') return port.path === '';
        return topLevel
            ? pointerTokens(port.path).length === 1
            : port.path === '';
    });
}

export function patchNodeLabel(node: PatchNode, modules: ModuleInfo[]): string {
    if (node.label?.trim()) return node.label;
    if (node.kind === 'output') return humanize(node.name);
    if (node.kind !== 'module') return node.name;
    const module = modules.find((item) => item.key === node.moduleKey);
    return module ? displayModuleName(module) : 'Module unavailable';
}

/** Prefer a concise author-supplied title to the Rust registration name. */
export function displayModuleName(module: ModuleInfo): string {
    const input = modulePorts(module, 'arguments')[0];
    const schema = input && resolveSchema(input.schema, input.root);
    const title =
        object(schema) && typeof schema.title === 'string'
            ? schema.title.trim()
            : '';
    return title && title.length <= 64 && !/[\r\n]/u.test(title)
        ? title
        : humanize(module.name);
}

function nodeRole(
    node: PatchNode,
    outputs: SchemaPort[],
    inputs: SchemaPort[],
): string {
    if (node.kind === 'variable') return 'Variable';
    if (node.kind === 'parameter') return 'Patch input';
    if (node.kind === 'subpatch') return 'Reusable patch';
    const output = (node.kind === 'output' ? inputs : outputs).find(
        (port) => port.path === '',
    );
    const shape = output && resolveSchema(output.schema, output.root);
    if (node.kind === 'output')
        return object(shape) && shape['x-sapio-role'] === 'contract'
            ? 'Contract output'
            : 'Output';
    return object(shape) && shape['x-sapio-role'] === 'contract'
        ? 'Contract builder'
        : 'Composer';
}

function literalAt(node: PatchNode, path: string): JsonValue | undefined {
    if (node.kind === 'output') return undefined;
    let value =
        node.kind === 'module' || node.kind === 'subpatch'
            ? node.arguments
            : node.kind === 'variable'
              ? node.value
              : node.default;
    for (const token of pointerTokens(path)) {
        if (
            (!object(value) && !Array.isArray(value)) ||
            !Object.hasOwn(value, token)
        )
            return undefined;
        value = (value as Record<string, JsonValue>)[token];
    }
    return value;
}

function preview(value: JsonValue | undefined, depth = 0): string {
    if (value === undefined) return 'Set a value in the inspector';
    if (value === null) return 'null';
    if (Array.isArray(value))
        return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
    if (object(value)) {
        const fields = Object.entries(value);
        if (fields.length <= 2 && depth < 2) {
            const summary = fields
                .map(
                    ([name, field]) =>
                        `${humanize(name)}: ${preview(field, depth + 1)}`,
                )
                .join(' · ');
            return summary.length > 64 ? `${summary.slice(0, 61)}…` : summary;
        }
        return `${fields.length} fields`;
    }
    if (typeof value === 'string' && value.length === 0) return 'Empty string';
    const text = String(value);
    return text.length > 46 ? `${text.slice(0, 43)}…` : text;
}

function sourceFor(
    sources: Record<string, string>,
    path: string,
): string | undefined {
    return Object.entries(sources).find(
        ([sourcePath]) =>
            sourcePath === path || path.startsWith(`${sourcePath}/`),
    )?.[1];
}

export function portLabel(port: SchemaPort, allPorts: SchemaPort[]): string {
    const tokens = pointerTokens(port.path);
    let path = '';
    const ancestors = tokens.slice(0, -1).map((token) => {
        path += `/${escapePointer(token)}`;
        return (
            allPorts.find((item) => item.path === path)?.label ??
            humanize(token)
        );
    });
    return [...ancestors, port.label].join(' › ');
}

export function PatchNodeCard({
    id,
    data,
    selected,
}: NodeProps<FlowPatchNode>) {
    const { patchNode, modules } = data;
    const referenceOnly =
        patchNode.kind === 'module' && Boolean(data.referenceOnly);
    const showCallable =
        referenceOnly ||
        data.showCallable ||
        Boolean(data.connectionPending && data.compatibleCallable);
    const allInputs = data.inputs;
    const allOutputs = data.outputs;
    const inputs = visibleNodePorts(
        allInputs,
        'arguments',
        data.expanded,
        data.connectionPending && !referenceOnly
            ? [...data.connectedInputs, ...(data.compatibleInputs ?? [])]
            : data.connectedInputs,
        referenceOnly,
    );
    const outputs = visibleNodePorts(
        allOutputs,
        'returns',
        data.expanded,
        data.connectionPending && !referenceOnly
            ? [...data.connectedOutputs, ...(data.compatibleOutputs ?? [])]
            : data.connectedOutputs,
        referenceOnly,
    );
    const name = patchNodeLabel(patchNode, modules);
    const role = referenceOnly
        ? 'Callable implementation'
        : nodeRole(patchNode, allOutputs, allInputs);
    const missing =
        data.availability === 'missing' ||
        (patchNode.kind === 'module' &&
            !modules.some((module) => module.key === patchNode.moduleKey));
    const invalid = data.availability === 'invalid';
    const Icon = referenceOnly
        ? FunctionSquare
        : patchNode.kind === 'output'
          ? ArrowDownToLine
          : patchNode.kind === 'variable'
            ? Variable
            : patchNode.kind === 'parameter'
              ? SlidersHorizontal
              : patchNode.kind === 'subpatch'
                ? Component
                : role === 'Contract builder'
                  ? Vault
                  : Box;
    const updateInternals = useUpdateNodeInternals();
    const handleLayout = JSON.stringify([
        inputs.map((port) => port.path),
        outputs.map((port) => port.path),
        showCallable,
    ]);
    useEffect(() => {
        updateInternals(id);
    }, [id, handleLayout, updateInternals]);
    const hasExpandedPorts =
        allInputs.length > inputs.length ||
        allOutputs.length > outputs.length ||
        data.expanded;
    const compatibleInputs = new Set(data.compatibleInputs ?? []);
    const compatibleOutputs = new Set(data.compatibleOutputs ?? []);
    const connectionClass = (compatible: boolean) =>
        !data.connectionPending
            ? ''
            : compatible
              ? 'patch-port-compatible'
              : 'patch-port-unavailable';
    const connectionHint = (compatible: boolean) =>
        !data.connectionPending
            ? undefined
            : compatible
              ? 'Compatible connection'
              : 'Cannot connect here';
    return (
        <article
            className={`patch-module patch-node-card patch-node-${patchNode.kind} ${selected ? 'patch-module-selected' : ''} ${data.status ?? ''} ${missing || invalid ? 'patch-node-unavailable' : ''}`}
            aria-label={`${name}, ${role}`}
            data-node-kind={patchNode.kind}
            data-reference-only={referenceOnly || undefined}
        >
            <header className="patch-module-title">
                <span className="patch-module-icon">
                    <Icon size={16} />
                </span>
                <div>
                    <small className="patch-node-role">{role}</small>
                    <strong
                        title={
                            patchNode.kind === 'module'
                                ? `${name}\nModule ${patchNode.moduleKey}`
                                : name
                        }
                    >
                        {name}
                    </strong>
                </div>
                {data.status === 'running' && (
                    <LoaderCircle
                        size={16}
                        className="patch-node-spinner"
                        aria-label="Running"
                    />
                )}
                {data.status === 'complete' && (
                    <CheckCircle2 size={16} aria-label="Completed" />
                )}
                {(missing || invalid) && (
                    <AlertCircle
                        size={16}
                        aria-label={
                            missing ? 'Module unavailable' : 'Needs attention'
                        }
                    />
                )}
            </header>
            {referenceOnly && (
                <p className="patch-reference-note">
                    The calling module supplies the inputs.
                </p>
            )}
            {patchNode.kind === 'output' && (
                <p className="patch-output-note">
                    {data.connectedInputs.length
                        ? role === 'Contract output'
                            ? 'Build this contract to open its transaction graph.'
                            : 'Build this value to review or export it.'
                        : 'Wire a result here. Contracts open their transaction graph.'}
                </p>
            )}
            {(patchNode.kind === 'variable' ||
                patchNode.kind === 'parameter') && (
                <div
                    className={`patch-node-value ${literalAt(patchNode, '') === undefined ? 'patch-node-value-unset' : ''}`}
                >
                    {patchNode.kind === 'parameter' && (
                        <small>
                            {patchNode.default === undefined
                                ? 'Required patch input'
                                : 'Default value'}
                        </small>
                    )}
                    <span>{preview(literalAt(patchNode, ''))}</span>
                </div>
            )}
            <div className="patch-module-ports">
                {inputs.length > 0 && (
                    <div className="patch-module-inputs">
                        <small>
                            {patchNode.kind === 'output'
                                ? 'VALUE TO BUILD'
                                : 'INPUTS'}
                        </small>
                        {inputs.map((port) => {
                            const provider = sourceFor(
                                data.inputSources,
                                port.path,
                            );
                            const literal = literalAt(patchNode, port.path);
                            const childrenConnected = Object.keys(
                                data.inputSources,
                            ).some((path) => path.startsWith(`${port.path}/`));
                            const source = provider
                                ? `← ${provider}`
                                : childrenConnected
                                  ? 'Fields connected'
                                  : literal !== undefined
                                    ? 'Local value'
                                    : port.required
                                      ? 'Choose or connect…'
                                      : 'Optional · choose or connect';
                            return (
                                <div
                                    key={port.path}
                                    className={`patch-port-row ${provider ? 'patch-port-connected' : ''} ${connectionClass(compatibleInputs.has(port.path))}`}
                                    title={`${portLabel(port, allInputs)} · ${schemaLabel(port)}\n${source}${data.connectionPending ? `\n${connectionHint(compatibleInputs.has(port.path))}` : ''}`}
                                    data-connection-fit={
                                        data.connectionPending
                                            ? compatibleInputs.has(port.path)
                                                ? 'compatible'
                                                : 'unavailable'
                                            : undefined
                                    }
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
                                        aria-label={`${name} input ${port.label}`}
                                        aria-description={connectionHint(
                                            compatibleInputs.has(port.path),
                                        )}
                                    />
                                    <button
                                        type="button"
                                        className="patch-input-button nodrag nopan"
                                        onClick={() => data.onInput(port.path)}
                                        aria-label={
                                            patchNode.kind === 'output'
                                                ? `${name}: connect output`
                                                : `${name}: configure ${portLabel(port, allInputs)}`
                                        }
                                        title={
                                            patchNode.kind === 'output'
                                                ? 'Wire a Contract result here to build and inspect it. Other values can be exported too.'
                                                : undefined
                                        }
                                    >
                                        <span className="patch-input-title">
                                            {portLabel(port, allInputs)}
                                        </span>
                                        <em>
                                            {patchNode.kind === 'output' &&
                                            !provider
                                                ? 'Type follows the wire'
                                                : schemaLabel(port)}
                                        </em>
                                        <span
                                            className={`patch-input-source ${literal === undefined && !provider && !childrenConnected && port.required ? 'patch-input-missing' : ''}`}
                                        >
                                            {source}
                                        </span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
                {outputs.length > 0 && (
                    <div className="patch-module-outputs">
                        <small>
                            {role === 'Contract builder'
                                ? 'CONTRACT'
                                : 'VALUE OUTPUT'}
                        </small>
                        {outputs.map((port) => (
                            <div
                                key={port.path}
                                className={`patch-port-row ${connectionClass(compatibleOutputs.has(port.path))}`}
                                title={`${portLabel(port, allOutputs)} · ${schemaLabel(port)}${data.connectionPending ? `\n${connectionHint(compatibleOutputs.has(port.path))}` : ''}`}
                                data-connection-fit={
                                    data.connectionPending
                                        ? compatibleOutputs.has(port.path)
                                            ? 'compatible'
                                            : 'unavailable'
                                        : undefined
                                }
                            >
                                <span>
                                    {port.path === ''
                                        ? schemaLabel(port)
                                        : portLabel(port, allOutputs)}
                                </span>
                                {port.path !== '' && (
                                    <em>{schemaLabel(port)}</em>
                                )}
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`value:${port.path}`}
                                    className={
                                        port.kind === 'module'
                                            ? 'patch-handle-module'
                                            : ''
                                    }
                                    aria-label={`${name} output ${port.label}`}
                                    aria-description={connectionHint(
                                        compatibleOutputs.has(port.path),
                                    )}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {(missing || invalid || data.message) && (
                <p className="patch-node-message" role="status">
                    {data.message ??
                        (missing
                            ? 'Load this module to inspect and execute its interface.'
                            : 'Review this node before compiling.')}
                </p>
            )}
            {patchNode.kind === 'module' && showCallable && (
                <div
                    className={`patch-module-ref ${connectionClass(data.compatibleCallable ?? false)}`}
                    title="Pass this module’s callable implementation. Its caller supplies the arguments; local inputs on this card are not used for the call."
                    data-connection-fit={
                        data.connectionPending
                            ? data.compatibleCallable
                                ? 'compatible'
                                : 'unavailable'
                            : undefined
                    }
                >
                    <span>
                        <FunctionSquare size={12} /> Callable implementation
                    </span>
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="module"
                        className="patch-handle-module"
                        aria-label={`${name} module reference output`}
                        aria-description={connectionHint(
                            data.compatibleCallable ?? false,
                        )}
                    />
                </div>
            )}
            <footer className="patch-node-footer">
                {patchNode.kind === 'output' && (
                    <button
                        type="button"
                        className="patch-output-build nodrag nopan"
                        aria-label={`${name}: build output`}
                        disabled={!data.canBuild}
                        onClick={data.onBuild}
                    >
                        <Play size={13} /> Build output
                    </button>
                )}
                {hasExpandedPorts && (
                    <button
                        type="button"
                        className="patch-expand nodrag nopan"
                        onClick={data.onExpand}
                    >
                        {data.expanded ? (
                            <ChevronUp size={12} />
                        ) : (
                            <ChevronDown size={12} />
                        )}
                        {referenceOnly
                            ? data.expanded
                                ? 'Hide direct-call ports'
                                : 'Show direct-call ports'
                            : data.expanded
                              ? 'Compact fields'
                              : 'Show record fields'}
                    </button>
                )}
                {patchNode.kind === 'module' && (
                    <button
                        type="button"
                        className="patch-callable-toggle nodrag nopan"
                        onClick={data.onShowCallable}
                        aria-pressed={data.showCallable}
                    >
                        <FunctionSquare size={12} />
                        {data.showCallable
                            ? 'Hide callable outlet'
                            : 'Use as callable…'}
                    </button>
                )}
            </footer>
        </article>
    );
}

export const nodeTypes = { patch: PatchNodeCard };
