// @vitest-environment node
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { exportDocument } from './document-export';

it('exports private files and replaces an existing readable file without retaining its old tail', async () => {
    const directory = await mkdtemp(
        path.join(os.tmpdir(), 'studio-export-test-'),
    );
    try {
        const file = path.join(directory, 'spend-intent.json');
        await exportDocument(file, '{"intent":"original"}');
        if (process.platform !== 'win32')
            expect((await stat(file)).mode & 0o777).toBe(0o600);
        const existing = path.join(directory, 'existing.psbt');
        await writeFile(existing, 'previous longer contents', { mode: 0o644 });
        await exportDocument(existing, 'new PSBT');
        expect(await readFile(existing, 'utf8')).toBe('new PSBT');
        if (process.platform !== 'win32')
            expect((await stat(existing)).mode & 0o777).toBe(0o600);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
