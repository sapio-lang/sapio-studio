import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { JsonValue } from '../../shared/studio';
import type { Patch, PatchNode } from './engine';
import { schemaLabel, type SchemaPort, type ValueType } from './schema';

interface PatchInspectorProps {
    selectedNode: PatchNode | undefined;
    nodeName: string | undefined;
    addingVariable: boolean;
    variableType: string;
    typeChoices: { name: string; type: ValueType }[];
    discovering: boolean;
    running: boolean;
    invalid: boolean;
    sourcePicker: ReactNode;
    editor: ReactNode;
    outputs: SchemaPort[];
    namedOutputs: Patch['outputs'];
    outputName: string;
    outputPath: string;
    result: JsonValue | undefined;
    onClose: () => void;
    onVariableTypeChange: (value: string) => void;
    onCreateVariable: () => void;
    onRename: (value: string) => void;
    onEditDefinition: () => void;
    onParameterNameChange: (value: string) => void;
    onMakeLocalVariable: () => void;
    onExposeParameter: () => void;
    onEvaluate: () => void;
    onOutputNameChange: (value: string) => void;
    onOutputPathChange: (value: string) => void;
    onDeclareOutput: () => void;
    onRemoveOutput: (name: string) => void;
}

export function PatchInspector({
    selectedNode,
    nodeName,
    addingVariable,
    variableType,
    typeChoices,
    discovering,
    running,
    invalid,
    sourcePicker,
    editor,
    outputs,
    namedOutputs,
    outputName,
    outputPath,
    result,
    onClose,
    onVariableTypeChange,
    onCreateVariable,
    onRename,
    onEditDefinition,
    onParameterNameChange,
    onMakeLocalVariable,
    onExposeParameter,
    onEvaluate,
    onOutputNameChange,
    onOutputPathChange,
    onDeclareOutput,
    onRemoveOutput,
}: PatchInspectorProps) {
    return (
        <aside className="patch-inspector" aria-label="Node inspector">
            <header>
                <div>
                    <small>
                        {addingVariable
                            ? 'NEW VALUE'
                            : selectedNode?.kind.toUpperCase()}
                    </small>
                    <h3>{addingVariable ? 'Add Variable' : nodeName}</h3>
                </div>
                <button aria-label="Close inspector" onClick={onClose}>
                    <X size={16} />
                </button>
            </header>
            {addingVariable ? (
                <>
                    <p className="patch-inspector-description">
                        Variables hold named values you can reuse. Creating one
                        from an input automatically gives it the matching type.
                    </p>
                    <label>
                        Variable type
                        <select
                            aria-label="Variable type"
                            value={variableType}
                            onChange={(event) =>
                                onVariableTypeChange(event.target.value)
                            }
                        >
                            {typeChoices.map((choice, index) => (
                                <option key={index} value={index}>
                                    {choice.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button onClick={onCreateVariable}>Create Variable</button>
                    {discovering && (
                        <p role="status">Reading available types…</p>
                    )}
                </>
            ) : (
                selectedNode && (
                    <>
                        <label>
                            Node name
                            <input
                                aria-label="Node name"
                                value={selectedNode.label ?? nodeName}
                                disabled={running}
                                onChange={(event) =>
                                    onRename(event.target.value)
                                }
                            />
                        </label>
                        {selectedNode.kind === 'subpatch' && (
                            <>
                                <p className="patch-context-note">
                                    This instance inherits the parent execution
                                    context. Its inputs override the
                                    definition’s parameter defaults.
                                </p>
                                <button onClick={onEditDefinition}>
                                    Edit definition
                                </button>
                            </>
                        )}
                        {sourcePicker}
                        {editor}
                        {(selectedNode.kind === 'variable' ||
                            selectedNode.kind === 'parameter') && (
                            <div className="patch-interface-controls">
                                {selectedNode.kind === 'parameter' ? (
                                    <>
                                        <label>
                                            Parameter name
                                            <input
                                                aria-label="Parameter name"
                                                value={selectedNode.name}
                                                onChange={(event) =>
                                                    onParameterNameChange(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                        <p>
                                            Callers provide this named input. An
                                            unset default makes it required.
                                        </p>
                                        <button
                                            disabled={running || invalid}
                                            onClick={onMakeLocalVariable}
                                        >
                                            Make local Variable
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        disabled={running || invalid}
                                        onClick={onExposeParameter}
                                    >
                                        Expose as parameter
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="patch-interface-controls">
                            <button
                                onClick={onEvaluate}
                                disabled={running || invalid}
                            >
                                Evaluate value
                            </button>
                            <label>
                                Output name
                                <input
                                    aria-label="Output name"
                                    value={outputName}
                                    onChange={(event) =>
                                        onOutputNameChange(event.target.value)
                                    }
                                />
                            </label>
                            <label>
                                Output value
                                <select
                                    aria-label="Output value"
                                    value={outputPath}
                                    onChange={(event) =>
                                        onOutputPathChange(event.target.value)
                                    }
                                >
                                    {outputs.map((port) => (
                                        <option
                                            key={port.path}
                                            value={port.path}
                                        >
                                            {port.label} · {schemaLabel(port)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button
                                disabled={running || !outputName.trim()}
                                onClick={onDeclareOutput}
                            >
                                Use as output
                            </button>
                        </div>
                        {namedOutputs.length > 0 && (
                            <div className="patch-named-outputs">
                                {namedOutputs.map((output) => (
                                    <div key={output.name}>
                                        <span>Output: {output.name}</span>
                                        <button
                                            aria-label={`Remove output ${output.name}`}
                                            onClick={() =>
                                                onRemoveOutput(output.name)
                                            }
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {result !== undefined && (
                            <details className="patch-result">
                                <summary>Inspect evaluated value</summary>
                                <pre>{JSON.stringify(result, null, 2)}</pre>
                            </details>
                        )}
                    </>
                )
            )}
        </aside>
    );
}
