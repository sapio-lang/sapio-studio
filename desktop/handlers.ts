import { ipcMain } from 'electron';
import { sapio } from './sapio';
import Client from 'bitcoin-core';
export default function (client: typeof Client) {
    ipcMain.handle('bitcoin-command', async (event, arg) => {
        let result = await client.command(arg);
        return result;
    });
    ipcMain.handle('create_contract', async (event, [which, args]) => {
        let result = await sapio.create_contract(which, args);
        return result;
    });
}
