import { describe, expect, it } from 'vitest';
import artifact from '../public/demo/starter-artifact.json';
import reference from '../public/demo/starter-explanation.json';
import type { BindFunding, Explanation, JsonObject } from '../shared/studio';
import boundReference from './fixtures/starter-bound.json';
import {
    extractContract,
    parseBinding,
    templateBindingKey,
} from './artifactSession';

// Captured with sapio-cli contract bind --mock and basic_config.json's
// native_ctv_research mode. These are local previews with no real funding.
const artifactText = JSON.stringify(artifact);
const explanation = reference as Explanation;
const text = JSON.stringify(boundReference);
const rootPath = artifact.root_path;
const root = explanation.artifact.nodes.find((node) => node.location === '')!;
const template = root.templates[0]!;

function parse(
    bound: unknown = boundReference,
    explained: Explanation = explanation,
    funding: BindFunding = { kind: 'mock' },
) {
    return parseBinding(
        artifactText,
        explained,
        JSON.stringify(bound),
        funding,
    );
}

describe('bound artifact sessions', () => {
    it('maps a real mock binding to distinct occurrences and exact transaction previews', () => {
        const session = parse();
        expect(session.text).toBe(text);
        expect(session.funding).toEqual({ kind: 'mock' });
        expect(Object.keys(session.occurrences).sort()).toEqual(
            explanation.artifact.nodes.map((node) => node.location).sort(),
        );
        const linked = boundReference.program.payment.txs[0]!.linked_psbt;
        expect(session.occurrences['']).toEqual({
            path: rootPath,
            outpoint: boundReference.program.payment.out,
            transactions: {
                [templateBindingKey(template)]: {
                    kind: 'suggested',
                    hash: template.hash,
                    psbt: linked.psbt,
                    hex: linked.hex,
                },
            },
        });
        const children = template.outputs.map(
            (output) => session.occurrences[output.contract_location]!,
        );
        expect(children.map((child) => child.path)).toEqual(
            [0, 1].map(
                (index) => `${rootPath}/@suggested/${template.hash}/#${index}`,
            ),
        );
        expect(children.map((child) => child.outpoint.split(':')[1])).toEqual([
            '0',
            '1',
        ]);
        expect(children[0]!.outpoint).not.toBe(children[1]!.outpoint);
    });

    it('associates templates by source-map order, not explanation or JSON key order', () => {
        const raw = structuredClone(artifact) as JsonObject;
        const original = (
            raw.suggested_template_hash_to_template_map as JsonObject
        )[template.hash]!;
        const hashA = '11'.repeat(32);
        const hashB = 'ee'.repeat(32);
        raw.template_hash_to_template_map = {
            [hashB]: original,
            [hashA]: original,
        };
        const explained = structuredClone(explanation);
        const explainedRoot = explained.artifact.nodes.find(
            (node) => node.location === '',
        )!;
        const program = structuredClone(boundReference.program) as JsonObject;
        const boundRoot = program[rootPath] as JsonObject;
        const originalTx = (boundRoot.txs as JsonObject[])[0]!;
        boundRoot.txs = ['first', 'second', 'third'].map((psbt) => ({
            linked_psbt: { ...(originalTx.linked_psbt as JsonObject), psbt },
        }));
        for (const hash of [hashB, hashA]) {
            const next = structuredClone(template);
            next.kind = 'committed';
            next.hash = hash;
            for (const output of next.outputs) {
                const oldLocation = output.contract_location;
                output.contract_location = oldLocation
                    .replace(
                        'suggested_template_hash_to_template_map',
                        'template_hash_to_template_map',
                    )
                    .replace(template.hash, hash);
                const child = structuredClone(
                    explanation.artifact.nodes.find(
                        (node) => node.location === oldLocation,
                    )!,
                );
                child.location = output.contract_location;
                explained.artifact.nodes.push(child);
                const oldPath = `${rootPath}/@suggested/${template.hash}/#${output.index}`;
                program[`${rootPath}/@next/${hash}/#${output.index}`] =
                    structuredClone(program[oldPath]!);
            }
            explainedRoot.templates.unshift(next);
        }
        explained.artifact.nodes.reverse();
        explainedRoot.templates.reverse();
        const session = parseBinding(
            JSON.stringify(raw),
            explained,
            JSON.stringify({ program }),
            { kind: 'mock' },
        );
        const transactions = session.occurrences['']!.transactions;
        expect(transactions[`committed:${hashA}`]!.psbt).toBe('first');
        expect(transactions[`committed:${hashB}`]!.psbt).toBe('second');
        expect(transactions[templateBindingKey(template)]!.psbt).toBe('third');
    });

    it('retains the explicit funding mode and verifies an outpoint binding', () => {
        const program = structuredClone(boundReference.program) as JsonObject;
        delete program[`${rootPath}/@funding`];
        const funding: BindFunding = {
            kind: 'outpoint',
            outpoint: boundReference.program.payment.out,
        };
        const session = parse({ program }, explanation, funding);
        expect(session.funding).toEqual(funding);
        funding.outpoint = `${'00'.repeat(32)}:0`;
        expect(session.funding).not.toEqual(funding);
        expect(() => parse({ program }, explanation, funding)).toThrow(
            'different funding outpoint',
        );
        expect(
            parse(boundReference, explanation, {
                kind: 'psbt',
                psbt: 'supplied funding',
            }).funding.kind,
        ).toBe('psbt');
    });

    it.each([
        [
            'missing occurrence',
            (program: JsonObject) => {
                delete program[`${rootPath}/@suggested/${template.hash}/#0`];
            },
        ],
        [
            'different contract source',
            (program: JsonObject) => {
                (program[rootPath] as JsonObject).source_path = 'other';
            },
        ],
        [
            'different transaction count',
            (program: JsonObject) => {
                (program[rootPath] as JsonObject).txs = [];
            },
        ],
        [
            'unrelated contract occurrences',
            (program: JsonObject) => {
                program.extra = program[rootPath]!;
            },
        ],
        [
            'invalid outpoint',
            (program: JsonObject) => {
                (program[rootPath] as JsonObject).out =
                    `${'00'.repeat(32)}:4294967296`;
            },
        ],
    ])('rejects a binding with %s', (message, change) => {
        const program = structuredClone(boundReference.program) as JsonObject;
        change(program);
        // A missing transaction fails when its expected linked PSBT is read.
        expect(() => parse({ program })).toThrow(
            message === 'different transaction count'
                ? 'Bound transaction'
                : message,
        );
    });

    it('rejects inconsistent output metadata and explanation occurrence identities', () => {
        const bound = structuredClone(boundReference);
        bound.program.payment.txs[0]!.linked_psbt.output_metadata.pop();
        expect(() => parse(bound)).toThrow('output count');
        const explained = structuredClone(explanation);
        explained.artifact.nodes.push(
            structuredClone(explained.artifact.nodes[0]!),
        );
        expect(() => parse(boundReference, explained)).toThrow(
            'repeats a contract location',
        );
        explained.artifact.nodes.pop();
        const output = explained.artifact.nodes.find(
            (node) => node.location === '',
        )!.templates[0]!.outputs[0]!;
        output.contract_location = template.outputs[1]!.contract_location;
        expect(() => parse(boundReference, explained)).toThrow(
            'different transaction output',
        );
    });

    it('rejects stale output values and extra or missing funding entries', () => {
        const explained = structuredClone(explanation);
        explained.artifact.nodes.find((node) => node.location === '')!
            .templates[0]!.outputs[0]!.amount_sats++;
        expect(() => parse(boundReference, explained)).toThrow(
            'different transaction output',
        );
        const program = structuredClone(boundReference.program) as JsonObject;
        delete program[`${rootPath}/@funding`];
        expect(() => parse({ program })).toThrow(
            'missing its funding transaction',
        );
        expect(() =>
            parse(boundReference, explanation, {
                kind: 'outpoint',
                outpoint: boundReference.program.payment.out,
            }),
        ).toThrow('unrelated contract occurrences');
    });
});

describe('contract occurrence extraction', () => {
    it('extracts the root and each child from the validated explanation', () => {
        expect(JSON.parse(extractContract(artifactText, ''))).toEqual(artifact);
        const original = `\n${JSON.stringify(artifact, null, 4)}\n`;
        expect(extractContract(original, '')).toBe(original);
        for (const output of template.outputs) {
            const selected = JSON.parse(
                extractContract(artifactText, output.contract_location),
            );
            expect(selected.required_input_amount_sats).toBe(
                explanation.artifact.nodes.find(
                    (node) => node.location === output.contract_location,
                )!.required_input_sats,
            );
        }
    });

    it('rejects an unsafe numeric literal in child metadata before reserializing', () => {
        const raw = structuredClone(artifact) as JsonObject;
        const templates =
            raw.suggested_template_hash_to_template_map as JsonObject;
        const outputs = (templates[template.hash] as JsonObject)
            .outputs_info as JsonObject[];
        const child = outputs[0]!.receiving_contract as JsonObject;
        (child.metadata as JsonObject).simp = {
            '42': { counter: 'raw-unsafe-number' },
        };
        const text = JSON.stringify(raw).replace(
            '"raw-unsafe-number"',
            '9007199254740993',
        );
        expect(() =>
            extractContract(text, template.outputs[0]!.contract_location),
        ).toThrow('Outside the exact integer range');
    });

    it('supports escaped own property names and rejects missing or non-contract values', () => {
        const text = JSON.stringify({ 'a/b~c': artifact, items: [artifact] });
        expect(JSON.parse(extractContract(text, '/a~1b~0c'))).toEqual(artifact);
        expect(JSON.parse(extractContract(text, '/items/0'))).toEqual(artifact);
        for (const pointer of [
            'items/0',
            '/items/00',
            '/items/-',
            '/items/1',
            '/a~2b',
            '/missing',
            '/constructor/prototype',
            '/items/0/root_path',
        ]) {
            expect(() => extractContract(text, pointer)).toThrow();
        }
    });
});
