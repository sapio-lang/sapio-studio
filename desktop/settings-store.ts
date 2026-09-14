import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { StudioSettings } from '../shared/studio';
import { object } from './cli';

export function validateSettings(value: unknown): StudioSettings {
    const input = object(value, 'Settings');
    for (const name of ['cliPath', 'workspace', 'runtimeConfig'] as const) {
        if (
            typeof input[name] !== 'string' ||
            input[name].includes('\0') ||
            input[name].length > 4096
        ) {
            throw new Error(`Invalid ${name}.`);
        }
    }
    const settings = input as unknown as StudioSettings;
    if (!settings.cliPath.trim())
        throw new Error('Choose the Sapio CLI executable.');
    if (!path.isAbsolute(settings.workspace))
        throw new Error('Workspace must be an absolute directory path.');
    if (settings.runtimeConfig && !path.isAbsolute(settings.runtimeConfig))
        throw new Error('Runtime configuration must be an absolute file path.');
    return {
        cliPath: settings.cliPath,
        workspace: settings.workspace,
        runtimeConfig: settings.runtimeConfig,
    };
}

export function createSettingsStore(file: string, defaultWorkspace: string) {
    const defaults: StudioSettings = {
        cliPath: process.env.SAPIO_CLI_BINARY || 'sapio-cli',
        workspace: defaultWorkspace,
        runtimeConfig: '',
    };
    return {
        async load(): Promise<StudioSettings> {
            try {
                return validateSettings(
                    JSON.parse(await readFile(file, 'utf8')),
                );
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                    return defaults;
                throw error;
            }
        },
        async save(value: unknown): Promise<StudioSettings> {
            const settings = validateSettings(value);
            await mkdir(path.dirname(file), { recursive: true });
            const temporary = `${file}.${randomUUID()}.tmp`;
            try {
                await writeFile(
                    temporary,
                    `${JSON.stringify(settings, null, 2)}\n`,
                    { mode: 0o600, flag: 'wx' },
                );
                await rename(temporary, file);
            } finally {
                await rm(temporary, { force: true });
            }
            return settings;
        },
    };
}
