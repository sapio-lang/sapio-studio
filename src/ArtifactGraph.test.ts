import { describe, expect, it } from 'vitest';
import reference from '../public/demo/starter-explanation.json';
import type { Explanation } from '../shared/studio';
import { artifactLayout } from './ArtifactGraph';

describe('validated artifact graph', () => {
    it('preserves distinct occurrences of a reused source path and exact output allocations', () => {
        const explanation = structuredClone(reference) as Explanation;
        for (const object of explanation.artifact.nodes)
            object.source_path = 'reused/source';
        const graph = artifactLayout(explanation);
        const outputNodes = graph.nodes.filter(
            (node) => node.type === 'artifact-output',
        );
        expect(outputNodes).toHaveLength(explanation.artifact.nodes.length);
        expect(new Set(outputNodes.map((node) => node.id)).size).toBe(
            explanation.artifact.nodes.length,
        );
        const outputEdges = graph.edges.filter((edge) => edge.label);
        expect(outputEdges.map((edge) => edge.label).sort()).toEqual([
            '13,500 sat',
            '6,000 sat',
        ]);
        for (const edge of graph.edges) {
            expect(graph.selections.has(edge.source)).toBe(true);
            expect(graph.selections.has(edge.target)).toBe(true);
        }
    });

    it('distinguishes a suggested transaction from a commitment without inventing authority', () => {
        const explanation = structuredClone(reference) as Explanation;
        const root = explanation.artifact.nodes.find(
            (node) => node.location === '',
        )!;
        expect(root.templates[0]!.kind).toBe('suggested');
        const graph = artifactLayout(explanation);
        const template = graph.nodes.find(
            (node) => node.type === 'artifact-template',
        )!;
        expect(graph.selections.get(template.id)).toMatchObject({
            kind: 'template',
            template: { kind: 'suggested', reserved_fee_sats: 500 },
        });
        expect(
            graph.edges.find((edge) => edge.target === template.id)?.style
                ?.strokeDasharray,
        ).toBe('5 4');
    });
});
