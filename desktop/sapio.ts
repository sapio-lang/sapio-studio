import spawn from 'await-spawn';
import { ChildProcessWithoutNullStreams, spawn as spawnSync } from 'child_process';

import { BrowserWindow, ipcMain, Menu } from 'electron';
import { settings } from './settings';

const memo_apis = new Map();
const memo_logos = new Map();

class SapioCompiler {
    #contract_cache: [string, string] | null;
    constructor() {
        this.#contract_cache = null;
    }
    async list_contracts(): Promise<
        Map<string, { name: string; key: string; api: string; logo: string }>
    > {
        const binary = settings.value('sapio.binary');
        const results = new Map();
        const contracts = (
            await spawn(binary, ['contract', 'list'])
        ).toString();
        let lines = contracts
            .trim()
            .split(/\r?\n/)
            .map((line: string) => line.split(' -- '));

        let apis = await Promise.all(
            lines.map(([name, key]: [string, string]) => {
                if (memo_apis.has(key)) {
                    return memo_apis.get(key);
                } else {
                    return spawn(binary, ['contract', 'api', '--key', key])
                        .then((v: any) => JSON.parse(v.toString()))
                        .then((api: any) => {
                            memo_apis.set(key, api);
                            return api;
                        });
                }
            })
        );
        let logos = await Promise.all(
            lines.map(([name, key]: [string, string]) => {
                if (memo_logos.has(key)) {
                    return memo_logos.get(key);
                } else {
                    return spawn(binary, ['contract', 'logo', '--key', key])
                        .then((logo: any) => logo.toString().trim())
                        .then((logo: string) => {
                            memo_logos.set(key, logo);
                            return logo;
                        });
                }
            })
        );

        for (var i = 0; i < lines.length; ++i) {
            const [name, key] = lines[i];
            const api = apis[i];
            const logo = logos[i];
            results.set(key, {
                name,
                key,
                api,
                logo,
            });
        }
        return results;
    }
    async load_contract_file_name(file: string) {
        const binary = settings.value('sapio.binary');
        const child = await spawn(binary, ['contract', 'load', '--file', file]);
        console.log(`child stdout:\n${child.toString()}`);
    }

    async recreate_contract(window: BrowserWindow) {
        window.webContents.send(
            'create_contract_from_cache',
            this.#contract_cache
        );
    }
    async create_contract(which: string, args: string) {
        this.#contract_cache = [which, args];
        update_menu('file-contract-recreate', true);
        const binary = settings.value('sapio.binary');
        let created, bound;
        try {
            const create = await spawn(binary, [
                'contract',
                'create',
                '--key',
                which,
                args,
            ]);
            created = create.toString();
        } catch (e) {
            console.debug('Failed to Create', which, args);
            return null;
        }
        try {
            const bind = await spawn(binary, ['contract', 'bind', created]);
            bound = bind.toString();
        } catch (e: any) {
            console.debug(created);
            console.log('Failed to bind', e.toString());
            return null;
        }
        try {
            const for_tux = await spawn(binary, ['contract', 'for_tux', bound]);
            const for_tuxed = for_tux.toString();
            console.debug(for_tuxed);
            return for_tuxed;
        } catch (e: any) {
            console.debug(bound);
            console.log('Failed to convert for tux', e.toString());
            return null;
        }
    }
}

function update_menu(id: string, enabled: boolean) {
    const menu = Menu.getApplicationMenu()!;
    const item = menu.getMenuItemById(id);
    if (item) item.enabled = enabled;
}
export const sapio = new SapioCompiler();


export function start_sapio_oracle() : ChildProcessWithoutNullStreams|null {
    const enabled = settings.value("sapio.oracle-local-enabled");
    if (enabled.includes("oracle-launch_on_startup")) {
        const binary = settings.value('sapio.binary');
        const seed = settings.value('sapio.oracle-seed-file');
        const iface = settings.value('sapio.oracle-netinterface');
        return spawnSync(binary, ['emulator', 'server', seed, iface]);
    }
    return null;

}