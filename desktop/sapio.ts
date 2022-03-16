import { equal } from 'assert';
import spawn from 'await-spawn';
import BufferList from 'bl';
import {
    ChildProcessWithoutNullStreams,
    spawn as spawnSync,
} from 'child_process';
import { JSONSchema7 } from 'json-schema';

import { BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { sys } from 'typescript';
import { preferences, sapio_config_file } from './settings';

const memo_apis = new Map();
const memo_logos = new Map();

type Result = { ok: string } | { err: string };
class SapioCompiler {
    constructor() {}
    static async command(args: string[]): Promise<Result> {
        const binary = preferences.data.sapio_cli.sapio_cli;
        const source = preferences.data.sapio_cli.preferences;
        let new_args: string[] = [];
        if (source === 'Default') {
            new_args = args;
        } else if ('File' in source) {
            new_args = ['--config', source.File, ...args];
        } else if ('Here' in source) {
            new_args = ['--config', sapio_config_file, ...args];
        } else {
            dialog.showErrorBox(
                'Improper Source',
                'This means your config file is corrupt, shutting down.'
            );
            sys.exit(1);
        }
        console.debug('[sapio]: ', binary, new_args);
        try {
            return { ok: (await spawn(binary, new_args)).toString() };
        } catch (e: any) {
            return { err: e.toString() };
        }
    }
    async show_config(): Promise<Result> {
        return await SapioCompiler.command(['configure', 'show']);
    }
    async list_contracts(): Promise<
        | {
              ok: Record<
                  string,
                  { name: string; key: string; api: JSONSchema7; logo: string }
              >;
          }
        | { err: string }
    > {
        const res = await SapioCompiler.command(['contract', 'list']);
        if ('err' in res) return res;
        const contracts = res.ok;
        let lines: Array<[string, string]> = contracts
            .trim()
            .split(/\r?\n/)
            .map((line: string) => {
                let v: string[] = line.split(' -- ')!;
                equal(v.length, 2);
                return v as [string, string];
            });

        const apis_p = Promise.all(
            lines.map(([name, key]: [string, string]): Promise<JSONSchema7> => {
                if (memo_apis.has(key)) {
                    return Promise.resolve(memo_apis.get(key));
                } else {
                    return SapioCompiler.command([
                        'contract',
                        'api',
                        '--key',
                        key,
                    ]).then((v) => {
                        if ('err' in v) return v;
                        const api = JSON.parse(v.ok);
                        memo_apis.set(key, api);
                        return api;
                    });
                }
            })
        );
        const logos_p = Promise.all(
            lines.map(([name, key]: [string, string]): Promise<Result> => {
                if (memo_logos.has(key)) {
                    return Promise.resolve(memo_logos.get(key));
                } else {
                    return SapioCompiler.command([
                        'contract',
                        'logo',
                        '--key',
                        key,
                    ])
                        .then((logo: Result) =>
                            'ok' in logo ? { ok: logo.ok.trim() } : logo
                        )
                        .then((logo: Result) => {
                            if ('err' in logo) return logo;
                            memo_logos.set(key, logo.ok);
                            return logo;
                        });
                }
            })
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
            if ('err' in logo) return logo;
            results[key] = {
                name,
                key,
                api,
                logo: logo.ok,
            };
        }
        return { ok: results };
    }
    async load_contract_file_name(file: string): Promise<{ ok: null }> {
        const child = await SapioCompiler.command([
            'contract',
            'load',
            '--file',
            file,
        ]);
        console.log(`child stdout:\n${child}`);
        return { ok: null };
    }

    async create_contract(
        which: string,
        args: string
    ): Promise<{ ok: string | null } | { err: string }> {
        let create, created, bound;
        try {
            create = await SapioCompiler.command([
                'contract',
                'create',
                '--key',
                which,
                args,
            ]);
        } catch (e) {
            console.debug('Failed to Create', which, args);
            return { ok: null };
        }
        if ('err' in create) return create;
        created = create.ok;
        let bind;
        try {
            bind = await SapioCompiler.command([
                'contract',
                'bind',
                '--base64_psbt',
                created,
            ]);
        } catch (e: any) {
            console.debug(created);
            console.log('Failed to bind', e.toString());
            return { ok: null };
        }
        if ('err' in bind) return bind;
        console.debug(bound);
        return bind;
    }
}

export const sapio = new SapioCompiler();

let g_emulator: null | ChildProcessWithoutNullStreams = null;
let g_emulator_log: string = '';

export function get_emulator_log(): string {
    return g_emulator_log;
}
export function start_sapio_oracle(): ChildProcessWithoutNullStreams | null {
    if (g_emulator !== null) return g_emulator;
    const oracle = preferences.data.local_oracle;
    if (oracle !== 'Disabled' && 'Enabled' in oracle) {
        const binary = preferences.data.sapio_cli.sapio_cli;
        const seed = oracle.Enabled.file;
        const iface = oracle.Enabled.interface;
        let emulator = spawnSync(binary, ['emulator', 'server', seed, iface]);
        if (emulator) {
            let quit = '';
            emulator.stderr.on('data', (data) => {
                quit += `${data}`;
            });
            emulator.on('exit', (code) => {
                if (quit !== '') {
                    console.error('Emulator Oracle Error', quit);
                    sys.exit();
                }
            });
            emulator.stdout.on('data', (data) => {
                g_emulator_log += `${data}`;
                console.log(`stdout: ${data}`);
            });
        }
        g_emulator = emulator;
        return g_emulator;
    }
    return null;
}

export function kill_emulator() {
    console.log('Killing Emulator');
    g_emulator_log = '';
    g_emulator?.kill();
    g_emulator = null;
}
