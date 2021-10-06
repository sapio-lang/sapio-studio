import { ipcRenderer, contextBridge } from 'electron';
import { IpcRendererEvent } from 'electron/main';

function bitcoin_command(command: { method: string; parameters: any[] }[]) {
    return ipcRenderer.invoke('bitcoin-command', command);
}

function create_contract(which: string, args: string): Promise<string> {
    return ipcRenderer.invoke('create_contract', [which, args]);
}

function open_contract_from_file(): Promise<string> {
    return ipcRenderer.invoke('open_contract_from_file');
}
function load_wasm_plugin() {
    return ipcRenderer.invoke('load_wasm_plugin');
}
function save_psbt(psbt: string): Promise<null> {
    return ipcRenderer.invoke('save_psbt', psbt);
}
function fetch_psbt(): Promise<null> {
    return ipcRenderer.invoke('fetch_psbt');
}
function save_contract(contract: string): Promise<null> {
    return ipcRenderer.invoke('save_contract', contract);
}

const callbacks = {
    simulate: 0,
    load_hex: 0,
    save_hex: 0,
    create_contracts: 0,
    load_contract: 0,
    'bitcoin-node-bar': 0,
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
function preferences_redux(listener: (preferences: any) => void) {
    ipcRenderer.on('preferencesUpdated', (_e, p) => listener(p));
}
function get_preferences_sync(): any {
    return ipcRenderer.sendSync('getPreferences');
}

function show_preferences() {
    ipcRenderer.send('showPreferences');
}
function load_contract_list() {
    return ipcRenderer.invoke('load_contract_list');
}

function write_clipboard(s: string) {
    ipcRenderer.invoke('write_clipboard', s);
}

const api = {
    bitcoin_command,
    register,
    create_contract,
    preferences_redux,
    get_preferences_sync,
    save_psbt,
    save_contract,
    fetch_psbt,
    load_wasm_plugin,
    open_contract_from_file,
    show_preferences,
    load_contract_list,
    write_clipboard,
};
contextBridge.exposeInMainWorld('electron', api);
