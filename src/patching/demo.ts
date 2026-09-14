import type { PatchFile } from './engine';

/** The same real nested WASM call exercised by Sapio's CLI integration suite. */
export function clauseTrampolinePatch(
    clauseKey: string,
    trampolineKey: string,
): PatchFile {
    const parties = {
        alice: '01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
        bob: '01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546c',
    };
    return {
        version: 1,
        context: { amount: 1, network: 'Regtest', lowering: 'Native' },
        nodes: [
            {
                id: 'clause',
                moduleKey: clauseKey,
                arguments: parties,
                position: { x: 80, y: 80 },
            },
            {
                id: 'trampoline',
                moduleKey: trampolineKey,
                arguments: { g: parties },
                position: { x: 500, y: 80 },
            },
        ],
        connections: [
            {
                id: 'clause-reference',
                kind: 'module',
                source: 'clause',
                sourcePath: '',
                target: 'trampoline',
                targetPath: '/v',
            },
        ],
    };
}
