import { build } from 'esbuild';

export async function buildDesktop() {
    await build({
        entryPoints: [
            'desktop/main.ts',
            'desktop/preload.ts',
            'desktop/schema-worker.ts',
        ],
        outdir: 'dist/desktop',
        outExtension: { '.js': '.cjs' },
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node24',
        external: ['electron'],
        sourcemap: true,
    });
}

await buildDesktop();
