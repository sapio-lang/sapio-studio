const { ipcMain } = require('electron');
const { sapio } = require("./sapio");

module.exports = function(client) {

    ipcMain.handle('bitcoin-command', async(event, arg) => {
        let result = await client.command(arg);
        return result;
    });
    ipcMain.handle('create_contract', async(event, [which, args]) => {
        let result = await sapio.create_contract(which, args);
        return result;
    });

}