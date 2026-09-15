import type { ModuleInfo } from '../../shared/studio';
import type { PatchFile } from './engine';
import { modulePorts } from './schema';

/** A typed value and a callable implementation enter distinct input sockets. */
export function clauseTrampolinePatch(
    provider: ModuleInfo,
    consumer: ModuleInfo,
): PatchFile {
    const sockets = modulePorts(consumer, 'arguments');
    const alice = sockets.find((socket) => socket.path === '/g/alice');
    const bob = sockets.find((socket) => socket.path === '/g/bob');
    if (!alice || !bob)
        throw new Error(
            'The example module does not expose its authorization-key inputs.',
        );
    return {
        version: 2,
        context: { amount: 1, network: 'Regtest', lowering: 'Native' },
        nodes: [
            {
                id: 'alice',
                kind: 'variable',
                name: 'Alice public key',
                type: { schema: alice.schema, root: alice.root },
                value: '01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
                position: { x: 60, y: 60 },
            },
            {
                id: 'bob',
                kind: 'variable',
                name: 'Bob public key',
                type: { schema: bob.schema, root: bob.root },
                value: '01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546c',
                position: { x: 60, y: 260 },
            },
            {
                id: 'clause',
                kind: 'module',
                moduleKey: provider.key,
                label: 'Authorization implementation',
                position: { x: 60, y: 460 },
            },
            {
                id: 'trampoline',
                kind: 'module',
                moduleKey: consumer.key,
                arguments: {},
                position: { x: 520, y: 120 },
            },
        ],
        connections: [
            ...['alice', 'bob'].map((name) => ({
                id: `${name}-key`,
                kind: 'value' as const,
                source: name,
                sourcePath: '',
                target: 'trampoline',
                targetPath: `/g/${name}`,
            })),
            {
                id: 'clause-reference',
                kind: 'module',
                source: 'clause',
                sourcePath: '',
                target: 'trampoline',
                targetPath: '/v',
            },
        ],
        outputs: [{ name: 'policy', node: 'trampoline', path: '' }],
        output: 'policy',
    };
}
