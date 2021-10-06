import { BrowserWindow, clipboard, dialog, ipcMain } from 'electron';
import { sapio } from './sapio';
import Client from 'bitcoin-core';
import { readFile, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
export default function (window: BrowserWindow, client: typeof Client) {
    ipcMain.handle('bitcoin-command', async (event, arg) => {
        let result = await client.command(arg);
        return result;
    });
    ipcMain.handle('load_contract_list', async (event) => {
        const contracts = await sapio.list_contracts();
        return contracts;
    });
    ipcMain.handle('create_contract', async (event, [which, args]) => {
        let result = await sapio.create_contract(which, args);
        return result;
    });
    ipcMain.handle('write_clipboard', (event, s: string) => {
        clipboard.writeText(s);
    });

    ipcMain.handle('load_wasm_plugin', (event) => {
        const plugin = dialog.showOpenDialogSync({
            properties: ['openFile'],
            filters: [{ extensions: ['wasm'], name: 'WASM' }],
        });
        if (plugin && plugin.length) sapio.load_contract_file_name(plugin[0]!);
    });

    ipcMain.handle('open_contract_from_file', (event) => {
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
            return data;
        }
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
}
