import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { open } from 'node:fs/promises';
import path from 'node:path';
import type { BridgeReply, DocumentKind, StudioAPI } from '../shared/studio';
import { createSapioBridge } from './bridge';
import { documentText, MAX_DOCUMENT_BYTES, object } from './cli';
import { createSettingsStore } from './settings-store';
import { exportDocument } from './document-export';

const filters: Record<DocumentKind, Electron.FileFilter[]> = {
    json: [{ name: 'JSON document', extensions: ['json'] }],
    psbt: [{ name: 'Base64 PSBT', extensions: ['psbt', 'txt'] }],
    transaction: [{ name: 'Transaction hex', extensions: ['hex', 'txt'] }],
    text: [
        { name: 'Text document', extensions: ['txt', 'json', 'psbt', 'hex'] },
    ],
};

function documentKind(value: unknown): DocumentKind {
    if (typeof value !== 'string' || !Object.hasOwn(filters, value))
        throw new Error('Unknown document type.');
    return value as DocumentKind;
}

async function readDocument(file: string): Promise<string> {
    const handle = await open(file, 'r');
    try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > MAX_DOCUMENT_BYTES)
            throw new Error('Select a document no larger than 32 MiB.');
        const buffer = Buffer.alloc(MAX_DOCUMENT_BYTES + 1);
        let length = 0;
        while (length < buffer.length) {
            const { bytesRead } = await handle.read(
                buffer,
                length,
                buffer.length - length,
                null,
            );
            if (!bytesRead) break;
            length += bytesRead;
        }
        if (length > MAX_DOCUMENT_BYTES)
            throw new Error('Document exceeds 32 MiB.');
        return documentText(
            buffer.subarray(0, length).toString('utf8'),
            'Document',
        );
    } finally {
        await handle.close();
    }
}

export function registerStudioHandlers(
    window: BrowserWindow,
    exampleDirectory: string,
): () => void {
    const select = async (
        title: string,
        fileFilters?: Electron.FileFilter[],
        directory = false,
    ) => {
        const result = await dialog.showOpenDialog(window, {
            title,
            properties: directory
                ? ['openDirectory', 'createDirectory']
                : ['openFile'],
            ...(fileFilters ? { filters: fileFilters } : {}),
        });
        return result.canceled ? null : (result.filePaths[0] ?? null);
    };
    const store = createSettingsStore(
        path.join(app.getPath('userData'), 'studio-settings.json'),
        path.join(app.getPath('userData'), 'workspace'),
    );
    const bridge = createSapioBridge({
        settings: store.load,
        temporaryDirectory: app.getPath('temp'),
        schemaWorker: path.join(__dirname, 'schema-worker.cjs'),
        exampleModules: [
            path.join(exampleDirectory, 'sapio_wasm_clause.wasm'),
            path.join(exampleDirectory, 'sapio_wasm_clause_trampoline.wasm'),
        ],
        selection: {
            module: () =>
                select('Load a Sapio contract module', [
                    { name: 'WebAssembly module', extensions: ['wasm'] },
                ]),
            key: () =>
                select('Select the binary Xpriv key authorizing this spend'),
            evaluator: () =>
                select(
                    'Select the exact WASM evaluator committed by this request',
                    [{ name: 'WebAssembly evaluator', extensions: ['wasm'] }],
                ),
        },
    });
    const api: StudioAPI = {
        ...bridge,
        settings: {
            load: store.load,
            save: store.save,
            status: bridge.status,
            async selectPath(kind) {
                if (kind === 'cli')
                    return select('Select the Sapio CLI executable');
                if (kind === 'workspace')
                    return select(
                        'Choose the module workspace',
                        undefined,
                        true,
                    );
                if (kind === 'runtime-config')
                    return select(
                        'Select the Sapio runtime configuration',
                        filters.json,
                    );
                throw new Error('Unknown path selection.');
            },
        },
        documents: {
            async open(kind) {
                const file = await select(
                    'Open a document',
                    filters[documentKind(kind)],
                );
                return file === null
                    ? null
                    : {
                          name: path.basename(file),
                          text: await readDocument(file),
                      };
            },
            async save(value) {
                object(value, 'Document');
                const kind = documentKind(value.kind);
                const text = documentText(value.text, 'Document');
                const name = documentText(value.name, 'Document name');
                const result = await dialog.showSaveDialog(window, {
                    title: 'Export document',
                    defaultPath: path.basename(name),
                    filters: filters[kind],
                });
                if (result.canceled || !result.filePath) return false;
                // The native save dialog is the explicit destination and overwrite choice.
                await exportDocument(result.filePath, text);
                return true;
            },
        },
    };
    const operations = {
        'settings.load': api.settings.load,
        'settings.save': api.settings.save,
        'settings.selectPath': api.settings.selectPath,
        'settings.status': api.settings.status,
        'documents.open': api.documents.open,
        'documents.save': api.documents.save,
        'modules.list': api.modules.list,
        'modules.load': api.modules.load,
        'modules.loadExamples': api.modules.loadExamples,
        'modules.info': api.modules.info,
        'modules.call': api.modules.call,
        'modules.validate': api.modules.validate,
        'modules.validateValue': api.modules.validateValue,
        explain: api.explain,
        bind: api.bind,
        'spend.prepare': api.spend.prepare,
        'spend.requests': api.spend.requests,
        'spend.status': api.spend.status,
        'spend.apply': api.spend.apply,
        'spend.signNative': api.spend.signNative,
        'spend.signProgram': api.spend.signProgram,
        'spend.finalize': api.spend.finalize,
    };
    for (const [name, operation] of Object.entries(operations)) {
        ipcMain.handle(
            `studio:${name}`,
            async (event, input: unknown): Promise<BridgeReply<unknown>> => {
                if (
                    event.sender !== window.webContents ||
                    event.senderFrame !== window.webContents.mainFrame
                ) {
                    return {
                        ok: false,
                        error: 'Only the Studio main window may request this operation.',
                    };
                }
                try {
                    const value = await (
                        operation as (value: unknown) => Promise<unknown>
                    )(input);
                    return { ok: true, value };
                } catch (error) {
                    return {
                        ok: false,
                        error:
                            error instanceof Error
                                ? error.message
                                : 'The operation failed.',
                    };
                }
            },
        );
    }
    return () => {
        for (const name of Object.keys(operations))
            ipcMain.removeHandler(`studio:${name}`);
    };
}
