import { BrowserWindow, clipboard, dialog, ipcMain } from 'electron';
import {
    get_emulator_log,
    kill_emulator,
    sapio,
    start_sapio_oracle,
} from './sapio';
import { readFile, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { preferences, Prefs } from './settings';
import { get_bitcoin_node } from './bitcoin_rpc';
import RpcError from 'bitcoin-core-ts/dist/src/errors/rpc-error';
export default function (window: BrowserWindow) {
    ipcMain.handle('bitcoin::command', async (event, arg) => {
        let node = await get_bitcoin_node();
        try {
            return { ok: await node.command(arg) };
        } catch (r: any) {
            if (r instanceof RpcError) {
                return {
                    err: { code: r.code, message: r.message, name: r.name },
                };
            } else if (r instanceof Error) {
                return { err: r.toString() };
            }
        }
    });

    ipcMain.handle('emulator::kill', (event) => {
        kill_emulator();
    });
    ipcMain.handle('emulator::start', (event) => {
        start_sapio_oracle();
    });
    ipcMain.handle('emulator::read_log', (event) => {
        return get_emulator_log();
    });

    ipcMain.handle('sapio::load_contract_list', async (event) => {
        const contracts = await sapio.list_contracts();
        return contracts;
    });
    ipcMain.handle('sapio::create_contract', async (event, [which, args]) => {
        let result = await sapio.create_contract(which, args);
        return result;
    });

    ipcMain.handle('sapio::show_config', async (event) => {
        return await sapio.show_config();
    });

    ipcMain.handle('sapio::load_wasm_plugin', (event) => {
        const plugin = dialog.showOpenDialogSync({
            properties: ['openFile'],
            filters: [{ extensions: ['wasm'], name: 'WASM' }],
        });
        if (plugin && plugin.length)
            return sapio.load_contract_file_name(plugin[0]!);
        return { err: 'No Plugin Selected' };
    });

    ipcMain.handle('sapio::open_contract_from_file', (event) => {
        const file = dialog.showOpenDialogSync(window, {
            properties: ['openFile'],
            filters: [
                {
                    extensions: ['json'],
                    name: 'Sapio Contract Object',
                },
            ],
        });
        if (file && file.length === 1) {
            const data = readFileSync(file[0]!, {
                encoding: 'utf-8',
            });
            return { ok: data };
        }
    });
    ipcMain.handle('sapio::compiled_contracts::list', (event) => {
        return sapio.list_compiled_contracts();
    });
    ipcMain.handle('sapio::compiled_contracts::trash', (event, file_name) => {
        return sapio.trash_compiled_contract(file_name);
    });

    ipcMain.handle('write_clipboard', (event, s: string) => {
        clipboard.writeText(s);
    });

    ipcMain.handle('save_psbt', async (event, psbt) => {
        let path = await dialog.showSaveDialog(window, {
            filters: [
                {
                    extensions: ['psbt'],
                    name: 'Partially Signed Bitcoin Transaction',
                },
            ],
        });
        if (path.filePath) {
            await writeFile(path.filePath, psbt);
        }
    });
    ipcMain.handle('fetch_psbt', async (event, psbt) => {
        let path = await dialog.showOpenDialog(window, {
            filters: [
                {
                    extensions: ['psbt'],
                    name: 'Partially Signed Bitcoin Transaction',
                },
            ],
        });
        if (path && path.filePaths.length) {
            return await readFile(path.filePaths[0]!, { encoding: 'utf-8' });
        }
    });
    ipcMain.handle('save_contract', async (event, psbt) => {
        let path = await dialog.showSaveDialog(window, {
            filters: [{ extensions: ['json'], name: 'Sapio Contract Object' }],
        });
        if (path.filePath) {
            await writeFile(path.filePath, psbt);
        }
    });

    ipcMain.handle(
        'save_settings',
        async (event, which: Prefs, data: string) => {
            return preferences.save(which, JSON.parse(data));
        }
    );

    ipcMain.handle('load_settings_sync', (event, which: Prefs) => {
        return preferences.data[which];
    });
    ipcMain.handle('select_filename', async (event) => {
        let path = await dialog.showOpenDialog(window);
        if (path && path.filePaths.length == 1) {
            return path.filePaths[0]!;
        }
        return null;
    });
}
