// @vitest-environment node
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { createSettingsStore } from './settings-store';

it('persists only public settings and surfaces malformed saved settings', async () => {
    const directory = await mkdtemp(
        path.join(os.tmpdir(), 'studio-settings-test-'),
    );
    try {
        const file = path.join(directory, 'settings.json');
        const store = createSettingsStore(file, directory);
        expect((await store.load()).workspace).toBe(directory);
        const value = {
            cliPath: '/selected/sapio-cli',
            workspace: directory,
            runtimeConfig: '',
        };
        await store.save({ ...value, ignoredSecret: 'not persisted' });
        expect(await store.load()).toEqual(value);
        expect(await readFile(file, 'utf8')).not.toContain('not persisted');
        if (process.platform !== 'win32')
            expect((await stat(file)).mode & 0o777).toBe(0o600);
        await writeFile(file, '{invalid');
        await expect(store.load()).rejects.toThrow();
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
