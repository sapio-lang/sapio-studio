import { useEffect, useId, useRef, useState } from 'react';
import type { JsonSchema, JsonValue } from '../../shared/studio';
import { escapePointer, object, schemaLabel, valuePorts } from './schema';
import {
    asValueSchema,
    choiceLabel,
    editorSchema,
    fieldName,
    hasConnectedDescendant,
    matchingChoice,
    parseEditorJson,
    parseNumericInput,
    replaceObjectField,
    scalarIssue,
    schemaChoices,
    selectedChoiceValue,
    valueSourceAt,
    type ValueSources,
} from './schemaValue';
import './schema-value-editor.css';

export interface SchemaValueEditorProps {
    schema: JsonSchema;
    rootSchema?: JsonSchema;
    value?: JsonValue;
    onChange: (value: JsonValue | undefined) => void;
    label?: string;
    path?: string;
    required?: boolean;
    sources?: ValueSources;
    onExtract?: (path: string, value: JsonValue, schema: JsonSchema) => void;
    onCreateVariable?: (path: string, schema: JsonSchema) => void;
    onDisconnect?: (path: string) => void;
    onValidityChange?: (path: string, valid: boolean, editorId: string) => void;
}

interface FieldProps extends SchemaValueEditorProps {
    rootSchema: JsonSchema;
    path: string;
    depth: number;
    sources: ValueSources;
    socketPaths: Set<string>;
    suppressActions: boolean;
}

function valueSummary(value: JsonValue | undefined): string {
    if (value === undefined) return 'Not set';
    if (value === null) return 'null';
    if (Array.isArray(value))
        return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
    if (object(value)) return `${Object.keys(value).length} fields supplied`;
    const text = String(value);
    return text.length > 72 ? `${text.slice(0, 69)}…` : text;
}

/** Values are controlled; invalid drafts remove the previous effective value.
 * Keeping only the text local prevents a failed edit from building stale data. */
function useDraftValidity(
    path: string,
    onValidityChange: SchemaValueEditorProps['onValidityChange'],
) {
    const id = useId();
    const callback = useRef(onValidityChange);
    callback.current = onValidityChange;
    useEffect(() => () => callback.current?.(path, true, id), [path, id]);
    return (valid: boolean) => callback.current?.(path, valid, id);
}

function TextValue({
    value,
    onChange,
    numeric,
    id,
    issueId,
    path,
    onValidityChange,
}: {
    value: JsonValue | undefined;
    onChange: (value: JsonValue | undefined) => void;
    numeric?: 'integer' | 'number';
    id: string;
    issueId: string;
    path: string;
    onValidityChange: SchemaValueEditorProps['onValidityChange'];
}) {
    const [text, setText] = useState(value === undefined ? '' : String(value));
    const [error, setError] = useState<string>();
    const lastSent = useRef(value);
    const setValid = useDraftValidity(path, onValidityChange);
    useEffect(() => {
        if (value !== lastSent.current) {
            setText(value === undefined ? '' : String(value));
            setError(undefined);
            setValid(true);
            lastSent.current = value;
        }
    }, [value]);
    function update(draft: string) {
        setText(draft);
        let next: JsonValue | undefined = draft;
        let message: string | undefined;
        if (numeric) {
            if (draft === '') next = undefined;
            else {
                try {
                    next = parseNumericInput(draft, numeric === 'integer');
                } catch (error) {
                    if (!(error instanceof Error)) throw error;
                    message = error.message;
                    next = undefined;
                }
            }
        }
        setError(message);
        setValid(message === undefined);
        lastSent.current = next;
        onChange(next);
    }
    return (
        <>
            <input
                id={id}
                type="text"
                inputMode={numeric ? 'decimal' : 'text'}
                autoComplete="off"
                spellCheck={false}
                value={text}
                placeholder="Not set"
                onChange={(event) => update(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${issueId}-draft` : issueId}
            />
            {error && (
                <p
                    id={`${issueId}-draft`}
                    className="schema-field-error"
                    role="alert"
                >
                    {error}
                </p>
            )}
        </>
    );
}

function JsonValueInput({
    value,
    onChange,
    label,
    path,
    onValidityChange,
}: Pick<SchemaValueEditorProps, 'value' | 'onChange' | 'onValidityChange'> & {
    label: string;
    path: string;
}) {
    const [text, setText] = useState(
        value === undefined ? '' : JSON.stringify(value, null, 2),
    );
    const [error, setError] = useState<string>();
    const lastSent = useRef(value);
    const id = useId();
    const setValid = useDraftValidity(path, onValidityChange);
    useEffect(() => {
        if (value !== lastSent.current) {
            setText(value === undefined ? '' : JSON.stringify(value, null, 2));
            setError(undefined);
            setValid(true);
            lastSent.current = value;
        }
    }, [value]);
    function update(draft: string) {
        setText(draft);
        let next: JsonValue | undefined;
        let message: string | undefined;
        if (draft.trim()) {
            try {
                next = parseEditorJson(draft);
            } catch (error) {
                if (!(error instanceof Error)) throw error;
                message =
                    error instanceof SyntaxError
                        ? 'Enter valid JSON. The previous value is not used while this draft is invalid.'
                        : error.message;
            }
        }
        setError(message);
        setValid(message === undefined);
        lastSent.current = next;
        onChange(next);
    }
    return (
        <div className="schema-json-editor">
            <label htmlFor={id}>{label} JSON</label>
            <textarea
                id={id}
                rows={6}
                value={text}
                onChange={(event) => update(event.target.value)}
                spellCheck={false}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
            />
            {error && (
                <p
                    id={`${id}-error`}
                    className="schema-field-error"
                    role="alert"
                >
                    {error}
                </p>
            )}
        </div>
    );
}

function UnionValue(props: FieldProps & { choices: JsonSchema[]; id: string }) {
    const { choices, value, rootSchema, onChange, sources, path } = props;
    const detected = matchingChoice(value, choices, rootSchema);
    const [selected, setSelected] = useState<number | undefined>(detected);
    const lastSent = useRef(value);
    useEffect(() => {
        if (lastSent.current !== value) {
            lastSent.current = value;
            setSelected(detected);
        }
    }, [value, detected]);
    function update(next: JsonValue | undefined) {
        lastSent.current = next;
        onChange(next);
    }
    const choice = selected === undefined ? undefined : choices[selected];
    return (
        <div className="schema-union">
            <select
                id={props.id}
                value={selected === undefined ? '' : selected}
                disabled={hasConnectedDescendant(sources, path)}
                onChange={(event) => {
                    const index =
                        event.target.value === ''
                            ? undefined
                            : Number(event.target.value);
                    setSelected(index);
                    update(
                        index === undefined
                            ? undefined
                            : selectedChoiceValue(choices[index]!, rootSchema),
                    );
                }}
            >
                <option value="">Choose a variant…</option>
                {choices.map((branch, index) => (
                    <option key={index} value={index}>
                        {choiceLabel(branch, rootSchema, index)}
                    </option>
                ))}
            </select>
            {choice !== undefined && (
                <ValueField
                    {...props}
                    key={selected}
                    schema={choice}
                    label={choiceLabel(choice, rootSchema, selected!)}
                    depth={props.depth + 1}
                    onChange={update}
                    suppressActions
                />
            )}
            {choice === undefined && value !== undefined && (
                <p className="schema-field-note">
                    Choose the variant to edit this value, or inspect its JSON
                    below.
                </p>
            )}
        </div>
    );
}

function ListValue(props: FieldProps & { shape: Record<string, JsonValue> }) {
    const { value, onChange, shape, path, sources } = props;
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState<JsonValue>();
    const [invalidDrafts, setInvalidDrafts] = useState<Set<string>>(new Set());
    const [items, setItems] = useState<(JsonValue | undefined)[]>(
        Array.isArray(value) ? value : [],
    );
    const lastSent = useRef(value);
    useEffect(() => {
        if (value !== lastSent.current) {
            setItems(Array.isArray(value) ? value : []);
            lastSent.current = value;
        }
    }, [value]);
    function publish(next: (JsonValue | undefined)[]) {
        setItems(next);
        const effective = next.every((item) => item !== undefined)
            ? next
            : undefined;
        lastSent.current = effective;
        onChange(effective);
    }
    const tuple = Array.isArray(shape.items) ? shape.items : undefined;
    const itemSchema = (index: number) =>
        tuple
            ? (asValueSchema(tuple[index]) ??
              asValueSchema(shape.additionalItems) ??
              true)
            : (asValueSchema(shape.items) ?? true);
    const fixedIndices = hasConnectedDescendant(sources, path);
    const atMaximum =
        typeof shape.maxItems === 'number' && items.length >= shape.maxItems;
    const canAdd =
        !atMaximum &&
        (!tuple ||
            items.length < tuple.length ||
            shape.additionalItems !== false);
    return (
        <div className="schema-list">
            {items.map((item, index) => (
                <div key={index} className="schema-list-item">
                    <ValueField
                        {...props}
                        schema={itemSchema(index)}
                        value={item}
                        label={`Item ${index + 1}`}
                        path={`${path}/${index}`}
                        depth={props.depth + 1}
                        required
                        suppressActions={false}
                        onChange={(next) => {
                            publish(
                                items.map((previous, position) =>
                                    position === index ? next : previous,
                                ),
                            );
                        }}
                    />
                    <button
                        type="button"
                        disabled={fixedIndices}
                        title={
                            fixedIndices
                                ? 'Disconnect list fields before changing their indices.'
                                : undefined
                        }
                        onClick={() =>
                            publish(
                                items.filter(
                                    (_, position) => position !== index,
                                ),
                            )
                        }
                        aria-label={`Remove item ${index + 1}`}
                    >
                        Remove
                    </button>
                </div>
            ))}
            {adding ? (
                <div className="schema-list-draft">
                    <ValueField
                        {...props}
                        schema={itemSchema(items.length)}
                        value={draft}
                        label="New item"
                        path={`${path}/${items.length}`}
                        depth={props.depth + 1}
                        required
                        sources={{}}
                        onChange={setDraft}
                        onCreateVariable={undefined}
                        onExtract={undefined}
                        onValidityChange={(inputPath, valid, editorId) => {
                            setInvalidDrafts((previous) => {
                                const next = new Set(previous);
                                if (valid) next.delete(editorId);
                                else next.add(editorId);
                                return next;
                            });
                            props.onValidityChange?.(
                                inputPath,
                                valid,
                                editorId,
                            );
                        }}
                    />
                    <div className="schema-field-actions">
                        <button
                            type="button"
                            disabled={
                                draft === undefined || invalidDrafts.size > 0
                            }
                            onClick={() => {
                                if (draft === undefined) return;
                                publish([...items, draft]);
                                setAdding(false);
                                setDraft(undefined);
                            }}
                        >
                            Add this item
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAdding(false);
                                setDraft(undefined);
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="schema-field-actions">
                    <button
                        type="button"
                        disabled={!canAdd}
                        onClick={() => setAdding(true)}
                    >
                        Add item
                    </button>
                    {value === undefined && items.length === 0 && (
                        <button type="button" onClick={() => publish([])}>
                            Use empty list
                        </button>
                    )}
                </div>
            )}
            {fixedIndices && (
                <p className="schema-field-note">
                    Connected fields keep their list positions. Disconnect them
                    before removing items.
                </p>
            )}
        </div>
    );
}

function ValueField(props: FieldProps) {
    const {
        schema,
        rootSchema,
        path,
        value,
        onChange,
        sources,
        required,
        depth,
    } = props;
    const id = useId();
    const shape = editorSchema(schema, rootSchema);
    const label =
        props.label ??
        (object(shape) && typeof shape.title === 'string'
            ? shape.title
            : 'Value');
    const owner = valueSourceAt(sources, path);
    const connectedChildren = hasConnectedDescendant(sources, path);
    const callable = object(shape) && object(shape['x-sapio-module']);
    const type = schemaLabel({
        schema,
        root: rootSchema,
        kind: callable ? 'module' : 'value',
    });
    const issue = scalarIssue(value, shape);
    const issueId = `${id}-help`;
    const description =
        object(shape) && typeof shape.description === 'string'
            ? shape.description
            : undefined;
    const unit =
        object(shape) && typeof shape['x-sapio-unit'] === 'string'
            ? shape['x-sapio-unit']
            : undefined;
    const choices = schemaChoices(shape);
    const properties =
        object(shape) && object(shape.properties)
            ? shape.properties
            : undefined;
    const objectFields = properties
        ? Object.entries(properties).flatMap(([name, property]) => {
              const child = asValueSchema(property);
              return child === undefined ? [] : [{ name, schema: child }];
          })
        : [];
    let control;
    if (owner) {
        control = (
            <div className="schema-connected">
                <span>Connected to</span>
                {owner.source.onNavigate ? (
                    <button type="button" onClick={owner.source.onNavigate}>
                        {owner.source.label} ↗
                    </button>
                ) : (
                    <strong>{owner.source.label}</strong>
                )}
                {props.onDisconnect && (
                    <button
                        type="button"
                        onClick={() => props.onDisconnect!(owner.path)}
                    >
                        Disconnect
                    </button>
                )}
            </div>
        );
    } else if (callable) {
        control = (
            <p className="schema-field-note">
                Connect a module that implements this callable interface. The
                calling module supplies its arguments.
            </p>
        );
    } else if (depth > 12) {
        control = (
            <p className="schema-field-note">
                Continue editing this nested value in its parent’s JSON editor.
            </p>
        );
    } else if (choices.length) {
        control = <UnionValue {...props} choices={choices} id={id} />;
    } else if (
        object(shape) &&
        (Array.isArray(shape.enum) || Object.hasOwn(shape, 'const'))
    ) {
        const values = Array.isArray(shape.enum) ? shape.enum : [shape.const!];
        const selected =
            value === undefined
                ? -1
                : values.findIndex(
                      (candidate) =>
                          JSON.stringify(candidate) === JSON.stringify(value),
                  );
        control = (
            <select
                id={id}
                value={selected < 0 ? '' : selected}
                onChange={(event) =>
                    onChange(
                        event.target.value === ''
                            ? undefined
                            : structuredClone(
                                  values[Number(event.target.value)]!,
                              ),
                    )
                }
            >
                <option value="">Choose a value…</option>
                {values.map((candidate, index) => (
                    <option key={index} value={index}>
                        {typeof candidate === 'string'
                            ? candidate
                            : JSON.stringify(candidate)}
                    </option>
                ))}
            </select>
        );
    } else if (properties) {
        const fields = (
            <div className="schema-record-fields">
                {objectFields.map(({ name, schema: child }) => {
                    return (
                        <ValueField
                            {...props}
                            key={name}
                            schema={child}
                            path={`${path}/${escapePointer(name)}`}
                            value={object(value) ? value[name] : undefined}
                            label={
                                object(child) && typeof child.title === 'string'
                                    ? child.title
                                    : fieldName(name)
                            }
                            required={
                                object(shape) &&
                                Array.isArray(shape.required) &&
                                shape.required.includes(name)
                            }
                            depth={depth + 1}
                            suppressActions={false}
                            onChange={(next) =>
                                onChange(replaceObjectField(value, name, next))
                            }
                        />
                    );
                })}
                {objectFields.length === 0 && (
                    <button type="button" onClick={() => onChange({})}>
                        Use empty record
                    </button>
                )}
            </div>
        );
        control =
            depth === 0 ? (
                fields
            ) : (
                <details className="schema-record">
                    <summary>
                        Edit fields ·{' '}
                        {connectedChildren
                            ? 'Some connected'
                            : valueSummary(value)}
                    </summary>
                    {fields}
                </details>
            );
    } else if (object(shape) && shape.type === 'array') {
        control = <ListValue {...props} shape={shape} />;
    } else if (object(shape) && shape.type === 'boolean') {
        control = (
            <select
                id={id}
                value={value === undefined ? '' : String(value)}
                onChange={(event) =>
                    onChange(
                        event.target.value === ''
                            ? undefined
                            : event.target.value === 'true',
                    )
                }
            >
                <option value="">Not set</option>
                <option value="true">True</option>
                <option value="false">False</option>
            </select>
        );
    } else if (object(shape) && shape.type === 'null') {
        control = (
            <button type="button" id={id} onClick={() => onChange(null)}>
                {value === null ? 'Value: null' : 'Use null'}
            </button>
        );
    } else if (
        object(shape) &&
        ['string', 'number', 'integer'].includes(String(shape.type))
    ) {
        control = (
            <TextValue
                id={id}
                issueId={issueId}
                value={value}
                onChange={onChange}
                path={path}
                onValidityChange={props.onValidityChange}
                numeric={
                    shape.type === 'integer' || shape.type === 'number'
                        ? shape.type
                        : undefined
                }
            />
        );
    } else if (shape === false) {
        control = (
            <p className="schema-field-error">This input accepts no values.</p>
        );
    } else {
        control = (
            <JsonValueInput
                value={value}
                onChange={onChange}
                label={label}
                path={path}
                onValidityChange={props.onValidityChange}
            />
        );
    }
    const editable = !owner && !callable && shape !== false;
    const constraints = object(shape)
        ? [
              typeof shape.minimum === 'number'
                  ? `Min ${shape.minimum}`
                  : undefined,
              typeof shape.maximum === 'number'
                  ? `Max ${shape.maximum}`
                  : undefined,
              typeof shape.minItems === 'number'
                  ? `At least ${shape.minItems} items`
                  : undefined,
              typeof shape.maxItems === 'number'
                  ? `At most ${shape.maxItems} items`
                  : undefined,
              typeof shape.format === 'string' ? shape.format : undefined,
          ]
              .filter(Boolean)
              .join(' · ')
        : '';
    return (
        <section
            className={`schema-value-field ${owner ? 'schema-field-wired' : ''}`}
            data-input-path={path}
        >
            <div className="schema-field-heading">
                <label htmlFor={id}>{label}</label>
                <span className="schema-field-type">
                    {type}
                    {unit ? ` · ${unit}` : ''}
                </span>
                {required && (
                    <span className="schema-field-required">Required</span>
                )}
            </div>
            {description && (
                <p className="schema-field-description">{description}</p>
            )}
            {control}
            <div id={issueId}>
                {!owner && issue && (
                    <p className="schema-field-error" role="alert">
                        {issue}
                    </p>
                )}
                {!owner && value === undefined && !connectedChildren && (
                    <p className="schema-field-unset">
                        {required
                            ? 'Required value is not set.'
                            : 'Not set · optional'}
                    </p>
                )}
                {constraints && (
                    <p className="schema-field-note">{constraints}</p>
                )}
            </div>
            {editable && (
                <div className="schema-field-actions">
                    {value !== undefined && !connectedChildren && (
                        <button
                            type="button"
                            onClick={() => onChange(undefined)}
                        >
                            Unset
                        </button>
                    )}
                    {object(shape) &&
                        Object.hasOwn(shape, 'default') &&
                        !connectedChildren && (
                            <button
                                type="button"
                                title={JSON.stringify(shape.default)}
                                onClick={() =>
                                    onChange(structuredClone(shape.default!))
                                }
                            >
                                Use default: {valueSummary(shape.default)}
                            </button>
                        )}
                    {props.onCreateVariable &&
                        !props.suppressActions &&
                        props.socketPaths.has(path) &&
                        value === undefined &&
                        !connectedChildren && (
                            <button
                                type="button"
                                onClick={() =>
                                    props.onCreateVariable!(path, schema)
                                }
                            >
                                Create variable
                            </button>
                        )}
                    {props.onExtract &&
                        !props.suppressActions &&
                        props.socketPaths.has(path) &&
                        value !== undefined &&
                        !connectedChildren && (
                            <button
                                type="button"
                                onClick={() =>
                                    props.onExtract!(path, value, schema)
                                }
                            >
                                Extract variable
                            </button>
                        )}
                </div>
            )}
            {editable &&
                !connectedChildren &&
                (properties ||
                    choices.length ||
                    (object(shape) && shape.type === 'array')) && (
                    <details className="schema-advanced">
                        <summary>Advanced JSON</summary>
                        <JsonValueInput
                            value={value}
                            onChange={onChange}
                            label={label}
                            path={path}
                            onValidityChange={props.onValidityChange}
                        />
                    </details>
                )}
        </section>
    );
}

/** Structured public values. Schema annotations improve editing; execution
 * remains responsible for complete schema and cross-field validation. */
export function SchemaValueEditor(props: SchemaValueEditorProps) {
    const rootSchema = props.rootSchema ?? props.schema;
    const path = props.path ?? '';
    const socketPaths = new Set(
        valuePorts({ schema: props.schema, root: rootSchema }, 'arguments')
            .filter((port) => port.kind === 'value')
            .map((port) => path + port.path),
    );
    return (
        <div className="schema-value-editor">
            <ValueField
                {...props}
                rootSchema={rootSchema}
                path={path}
                sources={props.sources ?? {}}
                depth={0}
                socketPaths={socketPaths}
                suppressActions={false}
            />
        </div>
    );
}
