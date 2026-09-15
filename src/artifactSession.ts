import type {
    BindFunding,
    Explanation,
    JsonObject,
    JsonValue,
    TemplateExplanation,
} from '../shared/studio';
import { parseEditorJson } from './patching/schemaValue';

export interface BoundTransaction {
    hash: string;
    kind: TemplateExplanation['kind'];
    psbt: string;
    /** The CLI's possibly unsigned transaction preview, not a final spend. */
    hex: string;
}

export interface BoundOccurrence {
    path: string;
    outpoint: string;
    transactions: Record<string, BoundTransaction>;
}

export interface BoundArtifact {
    text: string;
    funding: BindFunding;
    /** Keys are artifact JSON pointers, independent of reusable source paths. */
    occurrences: Record<string, BoundOccurrence>;
}

export type BindingRecord = BoundArtifact;

export function templateBindingKey(
    template: Pick<TemplateExplanation, 'kind' | 'hash'>,
): string {
    return `${template.kind}:${template.hash}`;
}

function requireMatch(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function object(value: JsonValue | undefined, label: string): JsonObject {
    requireMatch(
        value !== null && typeof value === 'object' && !Array.isArray(value),
        `${label} must be an object.`,
    );
    return value;
}

function array(value: JsonValue | undefined, label: string): JsonValue[] {
    requireMatch(Array.isArray(value), `${label} must be an array.`);
    return value;
}

function compiled(value: JsonValue | undefined): JsonObject {
    const result = object(value, 'Contract');
    requireMatch(
        typeof result.root_path === 'string' &&
            typeof result.required_input_amount_sats === 'number' &&
            Number.isSafeInteger(result.required_input_amount_sats) &&
            result.required_input_amount_sats >= 0 &&
            Object.hasOwn(result, 'address'),
        'Expected a compiled contract.',
    );
    return result;
}

/** Extract only an own JSON value; pointers cannot traverse prototypes. */
export function extractContract(
    artifactText: string,
    location: string,
): string {
    let value = parseEditorJson(artifactText);
    requireMatch(
        location === '' || location.startsWith('/'),
        'Invalid contract JSON pointer.',
    );
    if (location !== '') {
        for (const encoded of location.slice(1).split('/')) {
            requireMatch(
                !/~(?:[^01]|$)/.test(encoded),
                'Invalid JSON pointer escape.',
            );
            const part = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
            if (Array.isArray(value)) {
                requireMatch(
                    /^(0|[1-9][0-9]*)$/.test(part),
                    'Invalid JSON pointer array index.',
                );
                const index = Number(part);
                requireMatch(
                    Number.isSafeInteger(index) && index < value.length,
                    'Contract location does not exist.',
                );
                value = value[index]!;
            } else {
                const parent = object(value, 'Contract location');
                requireMatch(
                    Object.hasOwn(parent, part),
                    'Contract location does not exist.',
                );
                value = parent[part]!;
            }
        }
    }
    const selected = compiled(value);
    return location === '' ? artifactText : JSON.stringify(selected, null, 2);
}

function outpoint(value: JsonValue | undefined): string {
    requireMatch(
        typeof value === 'string' &&
            /^[0-9a-f]{64}:(0|[1-9][0-9]*)$/.test(value) &&
            Number(value.slice(65)) <= 0xffffffff,
        'Binding has an invalid outpoint.',
    );
    return value;
}

function linkedTransaction(value: JsonValue | undefined, outputCount?: number) {
    const entry = object(value, 'Bound transaction');
    requireMatch(
        Object.keys(entry).length === 1,
        'Unknown bound transaction format.',
    );
    const linked = object(entry.linked_psbt, 'Linked PSBT');
    requireMatch(
        typeof linked.psbt === 'string' &&
            linked.psbt.length > 0 &&
            typeof linked.hex === 'string' &&
            /^(?:[0-9a-f]{2})+$/.test(linked.hex),
        'Binding must contain a PSBT and transaction preview.',
    );
    const outputs = array(linked.output_metadata, 'Bound output metadata');
    const added = array(
        linked.added_output_metadata,
        'Bound added output metadata',
    );
    requireMatch(
        outputs.length === added.length &&
            (outputCount === undefined || outputs.length === outputCount),
        'Bound transaction output count differs from its template.',
    );
    return { psbt: linked.psbt, hex: linked.hex };
}

const templateMaps = [
    {
        field: 'template_hash_to_template_map',
        kind: 'committed',
        step: '@next',
    },
    {
        field: 'suggested_template_hash_to_template_map',
        kind: 'suggested',
        step: '@suggested',
    },
] as const;

/**
 * Associate a successful CLI binding with its validated artifact/explanation.
 * This checks graph correspondence; Bitcoin/PSBT validation remains in Sapio.
 */
export function parseBinding(
    artifactText: string,
    explanation: Explanation,
    text: string,
    funding: BindFunding,
): BoundArtifact {
    const root = compiled(JSON.parse(artifactText));
    const program = object(
        object(JSON.parse(text), 'Binding').program,
        'Bound program',
    );
    const nodes = new Map(
        explanation.artifact.nodes.map((node) => [node.location, node]),
    );
    requireMatch(
        nodes.size === explanation.artifact.nodes.length,
        'Explanation repeats a contract location.',
    );
    const occurrences: Record<string, BoundOccurrence> = Object.create(null);
    const visited = new Set<string>();
    const pending = [
        { contract: root, location: '', path: root.root_path as string },
    ];

    while (pending.length > 0) {
        const { contract, location, path } = pending.pop()!;
        requireMatch(!visited.has(path), 'Binding repeats an occurrence path.');
        visited.add(path);
        requireMatch(
            Object.hasOwn(program, path),
            `Binding is missing occurrence ${path}.`,
        );
        const bound = object(program[path], 'Bound occurrence');
        const source = contract.root_path;
        const node = nodes.get(location);
        requireMatch(
            node && node.source_path === source && bound.source_path === source,
            'Binding or explanation has a different contract source.',
        );
        requireMatch(
            node.required_input_sats === contract.required_input_amount_sats,
            'Explanation has different contract funding.',
        );
        const txs = array(bound.txs, 'Bound transactions');
        const explainedTemplates = new Map(
            node.templates.map((template) => [
                templateBindingKey(template),
                template,
            ]),
        );
        requireMatch(
            explainedTemplates.size === node.templates.length,
            'Explanation repeats a transaction template.',
        );
        const transactions: Record<string, BoundTransaction> =
            Object.create(null);
        let transactionIndex = 0;

        // Rust binds each BTreeMap in ascending SHA256 byte order, committed
        // before suggested. Explanation presentation order is not identity.
        for (const { field, kind, step } of templateMaps) {
            const templates = object(
                contract[field] ?? {},
                'Contract templates',
            );
            for (const hash of Object.keys(templates).sort()) {
                requireMatch(
                    /^[0-9a-f]{64}$/.test(hash),
                    'Invalid template hash.',
                );
                const template = object(
                    templates[hash],
                    'Transaction template',
                );
                const key = templateBindingKey({ kind, hash });
                const explained = explainedTemplates.get(key);
                requireMatch(
                    explained,
                    'Explanation is missing a transaction template.',
                );
                const outputs = array(
                    template.outputs_info,
                    'Template outputs',
                );
                const literal = object(
                    template.transaction_literal,
                    'Template transaction',
                );
                const txOutputs = array(literal.output, 'Transaction outputs');
                requireMatch(
                    outputs.length === explained.outputs.length &&
                        outputs.length === txOutputs.length,
                    'Explanation has a different transaction output count.',
                );
                const linked = linkedTransaction(
                    txs[transactionIndex++],
                    outputs.length,
                );
                transactions[key] = { hash, kind, ...linked };
                outputs.forEach((output, index) => {
                    const childLocation = `${location}/${field}/${hash}/outputs_info/${index}/receiving_contract`;
                    const explainedOutput = explained.outputs[index]!;
                    const literalOutput = object(
                        txOutputs[index],
                        'Transaction output',
                    );
                    requireMatch(
                        explainedOutput.index === index &&
                            explainedOutput.contract_location ===
                                childLocation &&
                            explainedOutput.amount_sats ===
                                literalOutput.value &&
                            explainedOutput.script_pubkey ===
                                literalOutput.script_pubkey,
                        'Explanation has a different transaction output.',
                    );
                    pending.push({
                        contract: compiled(
                            object(output, 'Template output')
                                .receiving_contract,
                        ),
                        location: childLocation,
                        path: `${path}/${step}/${hash}/#${index}`,
                    });
                });
            }
        }
        requireMatch(
            transactionIndex === txs.length &&
                transactionIndex === explainedTemplates.size,
            'Binding or explanation has a different transaction count.',
        );
        occurrences[location] = {
            path,
            outpoint: outpoint(bound.out),
            transactions,
        };
    }

    requireMatch(
        Object.keys(occurrences).length === nodes.size,
        'Explanation has unrelated contract occurrences.',
    );
    const fundingPath = `${root.root_path}/@funding`;
    if (funding.kind === 'outpoint') {
        requireMatch(
            occurrences['']!.outpoint === funding.outpoint,
            'Binding uses a different funding outpoint.',
        );
    } else {
        requireMatch(
            Object.hasOwn(program, fundingPath),
            'Binding is missing its funding transaction.',
        );
        const entry = object(program[fundingPath], 'Funding occurrence');
        requireMatch(
            entry.source_path === undefined,
            'Funding entry must not identify a contract source.',
        );
        outpoint(entry.out);
        const txs = array(entry.txs, 'Funding transactions');
        requireMatch(
            txs.length === 1,
            'Binding must contain exactly one funding transaction.',
        );
        linkedTransaction(txs[0]);
        visited.add(fundingPath);
    }
    requireMatch(
        visited.size === Object.keys(program).length,
        'Binding has unrelated contract occurrences.',
    );
    return { text, funding: structuredClone(funding), occurrences };
}
