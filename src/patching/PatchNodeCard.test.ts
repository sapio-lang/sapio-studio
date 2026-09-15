import { describe, expect, it } from 'vitest';
import {
    displayModuleName,
    patchNodeLabel,
    visibleNodePorts,
} from './PatchNodeCard';
import { valuePorts } from './schema';

describe('compact typed node cards', () => {
    it('uses the payload title rather than the generic CreateArgs field title', () => {
        const module = {
            key: 'b'.repeat(64),
            name: 'Signer',
            description: '',
            api: {
                arguments: {
                    type: 'object',
                    properties: {
                        arguments: {
                            allOf: [{ $ref: '#/definitions/Input' }],
                            title: 'The Main Contract Arguments',
                        },
                    },
                    definitions: {
                        Input: {
                            type: 'object',
                            title: 'Single-key authorization',
                        },
                    },
                },
                returns: { type: 'string' },
            },
        };
        expect(displayModuleName(module)).toBe('Single-key authorization');
    });
    it('uses an explicit concise payload title without displaying long documentation as a name', () => {
        const module = {
            key: 'a'.repeat(64),
            name: 'Signer',
            description: '',
            api: {
                arguments: {
                    type: 'object',
                    properties: {
                        arguments: {
                            type: 'object',
                            title: 'Single-key authorization',
                        },
                    },
                },
                returns: { type: 'string' },
            },
        };
        expect(displayModuleName(module)).toBe('Single-key authorization');
        module.api.arguments.properties.arguments.title =
            'A long explanation of what this module does belongs in the module description, not its name.';
        expect(displayModuleName(module)).toBe('Signer');
    });
    const type = {
        schema: {
            type: 'object',
            properties: {
                release: {
                    type: 'object',
                    properties: {
                        delay: { type: 'integer' },
                        destination: { type: 'string' },
                    },
                },
                recovery: { type: 'string' },
            },
        },
    };

    it('retains connected nested sockets while hiding unconnected record details', () => {
        const inputs = valuePorts(type, 'arguments');
        expect(
            visibleNodePorts(inputs, 'arguments', false, [
                '/release/delay',
            ]).map((port) => port.path),
        ).toEqual(['/release', '/release/delay', '/recovery']);
        const outputs = valuePorts(type);
        expect(
            visibleNodePorts(outputs, 'returns', false, [
                '/release/destination',
            ]).map((port) => port.path),
        ).toEqual(['', '/release/destination']);
        expect(
            visibleNodePorts(inputs, 'arguments', false, ['']).map(
                (port) => port.path,
            ),
        ).toContain('');
    });

    it('keeps scalar root sockets visible without requiring field expansion', () => {
        const ports = valuePorts({
            schema: { type: 'integer', title: 'Waiting period' },
        });
        expect(
            visibleNodePorts(ports, 'arguments', false, []).map(
                (port) => port.path,
            ),
        ).toEqual(['']);
        expect(
            visibleNodePorts(ports, 'returns', false, []).map(
                (port) => port.path,
            ),
        ).toEqual(['']);
    });

    it('uses human names for variables and keeps labels independent of identity', () => {
        const node = {
            kind: 'variable' as const,
            id: 'immutable-node-id',
            name: 'Waiting period',
            type: { schema: { type: 'integer' } },
            position: { x: 1, y: 2 },
            value: 144,
        };
        expect(patchNodeLabel(node, [])).toBe('Waiting period');
        expect(patchNodeLabel({ ...node, label: 'Withdrawal delay' }, [])).toBe(
            'Withdrawal delay',
        );
    });
});
