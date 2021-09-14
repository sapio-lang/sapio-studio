import { ipcRenderer, contextBridge } from 'electron';
import { IpcRendererEvent } from 'electron/main';

async function bitcoin_command(
    command: { method: string; parameters: any[] }[]
) {
    return ipcRenderer.invoke('bitcoin-command', command);
}

async function create_contract(which: string, args: string) {
    return ipcRenderer.invoke('create_contract', [which, args]);
}
async function save_psbt(psbt: string): Promise<null> {
    return ipcRenderer.invoke('save_psbt', psbt);
}
async function fetch_psbt(): Promise<null> {
    return ipcRenderer.invoke('fetch_psbt');
}
async function save_contract(contract: string): Promise<null> {
    return ipcRenderer.invoke('save_contract', contract);
}

const callbacks = {
    simulate: 0,
    load_hex: 0,
    save_hex: 0,
    create_contracts: 0,
    load_contract: 0,
    'bitcoin-node-bar': 0,
    create_contract_from_cache: 0,
};

type Callback = keyof typeof callbacks;

function register(msg: Callback, action: (args: any) => void): () => void {
    if (callbacks.hasOwnProperty(msg)) {
        const listener = (event: IpcRendererEvent, args: any) => {
            action(args);
        };
        ipcRenderer.on(msg, listener);
        return () => ipcRenderer.removeListener(msg, listener);
    }
    throw 'Unregistered Callback';
}
function get_preferences_sync() {
    return ipcRenderer.sendSync('getPreferences');
}
function preferences_listener(listener: (e: any, preferences: any) => void) {
    ipcRenderer.on('preferencesUpdated', listener);
}
const api = {
    bitcoin_command,
    register,
    create_contract,
    get_preferences_sync,
    preferences_listener,
    save_psbt,
    save_contract,
    fetch_psbt,
};
contextBridge.exposeInMainWorld('electron', api);
