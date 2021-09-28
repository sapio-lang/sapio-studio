import { equal } from 'assert';
import spawn from 'await-spawn';
import {
    ChildProcessWithoutNullStreams,
    spawn as spawnSync,
} from 'child_process';
import { JSONSchema7 } from 'json-schema';

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
    static async command(args: string[]): Promise<string> {
        const binary = settings.value('sapio.binary');
        const source = settings.value('sapio.configsource');
        console.log(source);
        let new_args: string[] = [];
        switch (source) {
            case 'default':
                new_args = args;
                break;
            case 'file':
                const config = settings.value('sapio.configfile');
                new_args = ['--config', config, ...args];
                break;
            case 'here':
                console.log(sapio_config_file);
                new_args = ['--config', sapio_config_file, ...args];
                break;
            default:
                dialog.showErrorBox('Improper Source', '');
                sys.exit(1);
        }
        console.debug('Callling', binary, new_args);
        return spawn(binary, new_args);
    }
    async list_contracts(): Promise<
        Record<
            string,
            { name: string; key: string; api: JSONSchema7; logo: string }
        >
    > {
        const contracts = (
            await SapioCompiler.command(['contract', 'list'])
        ).toString();
        let lines: Array<[string, string]> = contracts
            .trim()
            .split(/\r?\n/)
            .map((line: string) => {
                let v: string[] = line.split(' -- ')!;
                equal(v.length, 2);
                return v as [string, string];
            });

        const apis_p = Promise.all(
            lines.map(
                ([name, key]: [string, string]): Promise<JSONSchema7> => {
                    if (memo_apis.has(key)) {
                        return Promise.resolve(memo_apis.get(key));
                    } else {
                        return SapioCompiler.command([
                            'contract',
                            'api',
                            '--key',
                            key,
                        ]).then((v) => {
                            const api = JSON.parse(v.toString());
                            memo_apis.set(key, api);
                            return api;
                        });
                    }
                }
            )
        );
        const logos_p = Promise.all(
            lines.map(
                ([name, key]: [string, string]): Promise<string> => {
                    if (memo_logos.has(key)) {
                        return Promise.resolve(memo_logos.get(key));
                    } else {
                        return SapioCompiler.command([
                            'contract',
                            'logo',
                            '--key',
                            key,
                        ])
                            .then((logo: any) => logo.toString().trim())
                            .then((logo: string) => {
                                memo_logos.set(key, logo);
                                return logo;
                            });
                    }
                }
            )
        );
        const [apis, logos] = await Promise.all([apis_p, logos_p]);

        const results: Record<
            string,
            { name: string; key: string; api: Object; logo: string }
        > = {};
        equal(lines.length, apis.length);
        equal(lines.length, logos.length);
        for (var i = 0; i < lines.length; ++i) {
            const [name, key] = lines[i]!;
            const api = apis[i]!;
            const logo = logos[i]!;
            results[key] = {
                name,
                key,
                api,
                logo,
            };
        }
        return results;
    }
    async load_contract_file_name(file: string) {
        const child = await SapioCompiler.command([
            'contract',
            'load',
            '--file',
            file,
        ]);
        console.log(`child stdout:\n${child.toString()}`);
    }

    async recreate_contract(window: BrowserWindow): Promise<string | null> {
        if (this.#contract_cache)
            return this.create_contract(
                this.#contract_cache[0],
                this.#contract_cache[1]
            );
        return null;
    }
    async create_contract(which: string, args: string): Promise<string | null> {
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
            const bind = await SapioCompiler.command([
                'contract',
                'bind',
                '--base64_psbt',
                created,
            ]);
            bound = bind.toString();
            console.debug(bound);
            return bound;
        } catch (e: any) {
            console.debug(created);
            console.log('Failed to bind', e.toString());
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

export function start_sapio_oracle(): ChildProcessWithoutNullStreams | null {
    const enabled = settings.value('sapio.oracle-local-enabled');
    if (enabled) {
        const binary = settings.value('sapio.binary');
        const seed = settings.value('sapio.oracle-seed-file');
        const iface = settings.value('sapio.oracle-netinterface');
        return spawnSync(binary, ['emulator', 'server', seed, iface]);
    }
    return null;
}
