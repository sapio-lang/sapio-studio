const { app, BrowserWindow, ipcMain, ipcRenderer } = require('electron');
const { contextBridge } = require('electron')


async function bitcoin_command(command) {
    return ipcRenderer.invoke('bitcoin-command', command);
}

async function create_contract(which, args) {
    return ipcRenderer.invoke('create_contract', [which, args])

}

const callbacks = ["simulate", "load_hex", "save_hex", "create_contracts"];
function register(msg, action) {
    if (callbacks.includes(msg)) {
        const listener = (event, args) => {
            action(args)
        };
        ipcRenderer.on(msg, listener);
        return () => ipcRenderer.removeListener(msg, listener);
    }
    throw "Unregistered Callback";
    
}
contextBridge.exposeInMainWorld('electron', {
    bitcoin_command,
    register,
    create_contract,
})
