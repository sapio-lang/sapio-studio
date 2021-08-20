import { BrowserWindow, dialog, ipcMain } from 'electron';
import { sapio } from './sapio';
import Client from 'bitcoin-core';
import { writeFile } from 'fs/promises';
export default function (window: BrowserWindow, client: typeof Client) {
    ipcMain.handle('bitcoin-command', async (event, arg) => {
        let result = await client.command(arg);
        return result;
    });
    ipcMain.handle('create_contract', async (event, [which, args]) => {
        let result = await sapio.create_contract(which, args);
        return result;
    });
    ipcMain.handle("save_psbt", async (event, psbt) => {
        let path = await dialog.showSaveDialog(window, {
            filters: [{ extensions: ['psbt'], name: 'Partially Signed Bitcoin Transaction' }],
        });
        if (path.filePath) {
            await writeFile(path.filePath, psbt);
        }
    })
}
