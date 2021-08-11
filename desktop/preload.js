const { app, BrowserWindow, ipcMain, ipcRenderer } = require('electron');
const { contextBridge } = require('electron')

async function bitcoin_command(command) {
    return ipcRenderer.invoke('bitcoin-command', command);
}

const callbacks = ["simulate", "load_hex", "save_hex"];
function register(msg, action) {
    if (callbacks.includes(msg)) {
        const listener = (event, args) => {
            action(args)
        };
        ipcRenderer.on(msg, listener);
        return () => ipcRenderer.removeListener(msg, listener);
    }
    return () => {};
    
}
contextBridge.exposeInMainWorld('electron', {
    bitcoin_command: bitcoin_command,
    register: register
})
