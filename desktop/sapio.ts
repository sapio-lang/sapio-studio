import spawn from 'await-spawn';
import { ChildProcessWithoutNullStreams, spawn as spawnSync } from 'child_process';

import { BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { sys } from 'typescript';
import { sapio_config_file, settings } from './settings';

const memo_apis = new Map();
const memo_logos = new Map();

class SapioCompiler {
    #contract_cache: [string, string] | null;
    constructor() {
        this.#contract_cache = null;
    }
    static async command(args:string[]) : Promise<any> {
        const binary = settings.value('sapio.binary');
        const source = settings.value('sapio.configsource');
        console.log(source);
        let new_args : string[]= [];
        switch(source) {
            case "default":
                new_args = args;
                break;
            case "file":
                const config = settings.value('sapio.configfile');
                new_args = ["--config", config, ...args];
                break;
            case "here":
                console.log(sapio_config_file);
                new_args = ["--config", sapio_config_file, ...args];
                break;
            default:
                dialog.showErrorBox("Improper Source", "");
                sys.exit(1)
        }
        console.debug("Callling", binary, new_args);
        return spawn(binary, new_args);

    }
    async list_contracts(): Promise<
        Map<string, { name: string; key: string; api: string; logo: string }>
    > {
        const results = new Map();
        const contracts = (
            await SapioCompiler.command(['contract', 'list'])
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
                    return SapioCompiler.command(['contract', 'api', '--key', key])
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
                    return SapioCompiler.command(['contract', 'logo', '--key', key])
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
        const child = await SapioCompiler.command(['contract', 'load', '--file', file]);
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
        let created, bound;
        try {
            const create = await SapioCompiler.command([
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
            const bind = await SapioCompiler.command(['contract', 'bind', created]);
            bound = bind.toString();
        } catch (e: any) {
            console.debug(created);
            console.log('Failed to bind', e.toString());
            return null;
        }
        try {
            const for_tux = await SapioCompiler.command(['contract', 'for_tux', bound]);
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
    if (enabled) {
        const binary = settings.value('sapio.binary');
        const seed = settings.value('sapio.oracle-seed-file');
        const iface = settings.value('sapio.oracle-netinterface');
        return spawnSync(binary, ['emulator', 'server', seed, iface]);
    }
    return null;

}