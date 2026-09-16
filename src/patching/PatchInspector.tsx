import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { JsonValue } from '../../shared/studio';
import type { PatchNode } from './engine';
import { type ValueType } from './schema';

interface PatchInspectorProps {
    selectedNode: PatchNode | undefined;
    referenceOnly: boolean;
    nodeName: string | undefined;
    addingVariable: boolean;
    variableType: string;
    typeChoices: { name: string; type: ValueType }[];
    discovering: boolean;
    running: boolean;
    invalid: boolean;
    sourcePicker: ReactNode;
    editor: ReactNode;
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
    onConnectOutput: () => void;
}

export function PatchInspector({
    selectedNode,
    referenceOnly,
    nodeName,
    addingVariable,
    variableType,
    typeChoices,
    discovering,
    running,
    invalid,
    sourcePicker,
    editor,
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
    onConnectOutput,
}: PatchInspectorProps) {
    return (
        <aside className="patch-inspector" aria-label="Node inspector">
            <header>
                <div>
                    <small>
                        {addingVariable
                            ? 'NEW VALUE'
                            : referenceOnly
                              ? 'CALLABLE IMPLEMENTATION'
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
                            {selectedNode.kind === 'output'
                                ? 'Output name'
                                : 'Node name'}
                            <input
                                aria-label={
                                    selectedNode.kind === 'output'
                                        ? 'Output name'
                                        : 'Node name'
                                }
                                value={
                                    selectedNode.kind === 'output'
                                        ? selectedNode.name
                                        : (selectedNode.label ?? nodeName)
                                }
                                disabled={running}
                                onChange={(event) =>
                                    onRename(event.target.value)
                                }
                            />
                        </label>
                        {selectedNode.kind === 'output' && (
                            <>
                                <p className="patch-inspector-description">
                                    Wire a Contract result here to build and
                                    inspect it, or connect any declared value to
                                    export it. Its type follows the wire. This
                                    name becomes an output of a reusable patch.
                                </p>
                                <button onClick={onConnectOutput}>
                                    Choose output source
                                </button>
                            </>
                        )}
                        {referenceOnly && (
                            <p className="patch-reference-note">
                                The calling module supplies the inputs. Values
                                entered here are used only by Evaluate value for
                                a direct call.
                            </p>
                        )}
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
                                {selectedNode.kind === 'output'
                                    ? 'Build output'
                                    : 'Evaluate value'}
                            </button>
                        </div>
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
