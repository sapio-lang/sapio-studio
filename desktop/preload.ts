import { contextBridge, ipcRenderer } from 'electron';
import type { BridgeReply, StudioAPI } from '../shared/studio';

async function invoke<T>(operation: string, input?: unknown): Promise<T> {
    const reply = (await ipcRenderer.invoke(
        `studio:${operation}`,
        input,
    )) as BridgeReply<T>;
    if (!reply.ok) throw new Error(reply.error);
    return reply.value;
}

const studio: StudioAPI = {
    settings: {
        load: () => invoke('settings.load'),
        save: (settings) => invoke('settings.save', settings),
        selectPath: (kind) => invoke('settings.selectPath', kind),
        status: () => invoke('settings.status'),
    },
    documents: {
        open: (kind) => invoke('documents.open', kind),
        save: (document) => invoke('documents.save', document),
    },
    modules: {
        list: () => invoke('modules.list'),
        load: () => invoke('modules.load'),
        loadExamples: () => invoke('modules.loadExamples'),
        info: (key) => invoke('modules.info', key),
        call: (input) => invoke('modules.call', input),
        validate: (input) => invoke('modules.validate', input),
        validateValue: (input) => invoke('modules.validateValue', input),
    },
    explain: (input) => invoke('explain', input),
    bind: (input) => invoke('bind', input),
    spend: {
        prepare: (input) => invoke('spend.prepare', input),
        requests: (input) => invoke('spend.requests', input),
        status: (input) => invoke('spend.status', input),
        apply: (input) => invoke('spend.apply', input),
        signNative: (input) => invoke('spend.signNative', input),
        signProgram: (input) => invoke('spend.signProgram', input),
        finalize: (input) => invoke('spend.finalize', input),
    },
};

contextBridge.exposeInMainWorld('studio', studio);
