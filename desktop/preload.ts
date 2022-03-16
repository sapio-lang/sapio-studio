import { ipcRenderer, contextBridge } from 'electron';
import { IpcRendererEvent } from 'electron/main';

function bitcoin_command(
    command: { method: string; parameters: any[] }[]
): Promise<any> {
    return ipcRenderer.invoke('bitcoin::command', command).then((msg) => {
        if ('ok' in msg) {
            return msg.ok;
        } else if ('err' in msg) {
            throw new Error(JSON.stringify(msg.err));
        }
    });
}

type Result<T> = { ok: T } | { err: string };
function create_contract(which: string, args: string): Promise<Result<string>> {
    return ipcRenderer.invoke('sapio::create_contract', [which, args]);
}

function open_contract_from_file(): Promise<Result<string>> {
    return ipcRenderer.invoke('sapio::open_contract_from_file');
}
function load_wasm_plugin(): Promise<Result<null>> {
    return ipcRenderer.invoke('sapio::load_wasm_plugin');
}

function show_config(): Promise<Result<string>> {
    return ipcRenderer.invoke('sapio::show_config');
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
function save_settings(which: string, data: string): Promise<boolean> {
    return ipcRenderer.invoke('save_settings', which, data);
}

function load_settings_sync(which: string): any {
    return ipcRenderer.invoke('load_settings_sync', which);
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

function load_contract_list() {
    return ipcRenderer.invoke('load_contract_list');
}

function write_clipboard(s: string) {
    ipcRenderer.invoke('write_clipboard', s);
}

function select_filename() {
    return ipcRenderer.invoke('select_filename');
}

const api = {
    bitcoin_command,
    register,
    save_psbt,
    save_contract,
    fetch_psbt,
    write_clipboard,
    save_settings,
    load_settings_sync,
    select_filename,
    sapio: {
        create_contract,
        show_config,
        load_wasm_plugin,
        open_contract_from_file,
        load_contract_list,
    },
};
contextBridge.exposeInMainWorld('electron', api);
