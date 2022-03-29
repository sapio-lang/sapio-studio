import { app, BrowserWindow, clipboard, dialog, ipcMain } from 'electron';
import {
    get_emulator_log,
    kill_emulator,
    sapio,
    SapioWorkspace,
    start_sapio_oracle,
} from './sapio';
import { readFile, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { preferences, Prefs } from './settings';
import { get_bitcoin_node } from './bitcoin_rpc';
import RpcError from 'bitcoin-core-ts/dist/src/errors/rpc-error';
import path from 'path';
export default function (window: BrowserWindow) {
    ipcMain.handle('bitcoin::command', async (event, arg) => {
        const node = await get_bitcoin_node();
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
    ipcMain.handle(
        'sapio::create_contract',
        async (event, workspace, [which, psbt, args]) => {
            const result = await sapio.create_contract(
                workspace,
                which,
                psbt,
                args
            );
            return result;
        }
    );

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
    ipcMain.handle(
        'sapio::compiled_contracts::list',
        async (event, workspace) => {
            return (
                await SapioWorkspace.new(workspace)
            ).list_compiled_contracts();
        }
    );
    ipcMain.handle(
        'sapio::compiled_contracts::trash',
        async (event, workspace, file_name) => {
            return (
                await SapioWorkspace.new(workspace)
            ).trash_compiled_contract(file_name);
        }
    );
    ipcMain.handle('sapio::psbt::finalize', (event, psbt) => {
        return sapio.psbt_finalize(psbt);
    });
    ipcMain.handle(
        'sapio::compiled_contracts::open',
        async (event, workspace_name, file_name) => {
            const workspace = await SapioWorkspace.new(workspace_name);
            const data = await workspace.read_bound_data_for(file_name);
            const name = await workspace.read_module_for(file_name);
            const args = await workspace.read_args_for(file_name);
            return { ok: { data, name, args } };
        }
    );

    ipcMain.handle('sapio::workspaces::init', async (event, workspace) => {
        await SapioWorkspace.new(workspace);
    });
    ipcMain.handle('sapio::workspaces::list', async (event) => {
        return await SapioWorkspace.list_all();
    });
    ipcMain.handle('sapio::workspaces::trash', async (event, workspace) => {
        return (await SapioWorkspace.new(workspace)).trash_workspace(workspace);
    });

    ipcMain.handle('write_clipboard', (event, s: string) => {
        clipboard.writeText(s);
    });

    ipcMain.handle('save_psbt', async (event, psbt) => {
        const path = await dialog.showSaveDialog(window, {
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
        const path = await dialog.showOpenDialog(window, {
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
        const path = await dialog.showSaveDialog(window, {
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
        const path = await dialog.showOpenDialog(window);
        if (path && path.filePaths.length == 1) {
            return path.filePaths[0]!;
        }
        return null;
    });
}
