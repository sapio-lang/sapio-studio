import { equal } from 'assert';
import spawn from 'await-spawn';
import {
    ChildProcessWithoutNullStreams,
    spawn as spawnSync,
} from 'child_process';
import { JSONSchema7 } from 'json-schema';

import { app, dialog, shell } from 'electron';
import { sys } from 'typescript';
import { preferences, sapio_config_file } from './settings';
import path from 'path';
import * as Bitcoin from 'bitcoinjs-lib';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { API, Result } from '../src/common/preload_interface';
import { ConstructionRounded } from '@mui/icons-material';

const memo_apis = new Map();
const memo_logos = new Map();

export class SapioWorkspace {
    name: string;
    private constructor(name: string) {
        this.name = name;
    }
    static async list_all(): Promise<string[]> {
        const file = path.join(app.getPath('userData'), 'workspaces');
        return readdir(file, { encoding: 'ascii' });
    }
    static async new(name: string): Promise<SapioWorkspace> {
        const file = path.join(
            app.getPath('userData'),
            'workspaces',
            name,
            'compiled_contracts'
        );
        const created = await mkdir(file, { recursive: true });
        return new SapioWorkspace(name);
    }

    async list_compiled_contracts(): Promise<string[]> {
        const file = path.join(
            app.getPath('userData'),
            'workspaces',
            this.name,
            'compiled_contracts'
        );
        const contracts = await readdir(file, { encoding: 'ascii' });
        return contracts;
    }
    async trash_compiled_contract(s: string): Promise<void> {
        const file = path.join(
            app.getPath('userData'),
            'workspaces',
            this.name,
            'compiled_contracts',
            s
        );
        return shell.trashItem(file);
    }
    async trash_workspace(s: string): Promise<void> {
        const file = path.join(
            app.getPath('userData'),
            'workspaces',
            this.name
        );
        return shell.trashItem(file);
    }

    contract_output_path_name(fname: string) {
        return path.join(
            app.getPath('userData'),
            'workspaces',
            this.name,
            'compiled_contracts',
            fname
        );
    }
    async contract_output_path(fname: string) {
        const file = this.contract_output_path_name(fname);
        await mkdir(file, { recursive: true });
        return file;
    }

    async read_bound_data_for(file_name: string) {
        const file = this.contract_output_path_name(file_name);
        const data = JSON.parse(
            await readFile(path.join(file, 'bound.json'), {
                encoding: 'utf-8',
            })
        );
        return data;
    }
    async read_args_for(file_name: string) {
        const file = this.contract_output_path_name(file_name);
        const args = JSON.parse(
            await readFile(path.join(file, 'args.json'), {
                encoding: 'utf-8',
            })
        );
        return args;
    }

    async read_module_for(file_name: string): Promise<string> {
        const file = this.contract_output_path_name(file_name);
        const mod = await readFile(path.join(file, 'module.json'), {
            encoding: 'utf-8',
        });
        const name = JSON.parse(mod).module;
        return name;
    }
}

class SapioCompiler {
    static async command(args: string[]): Promise<Result<string>> {
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
        console.debug(['sapio'], binary, new_args);
        try {
            const ok = (await spawn(binary, new_args)).toString();
            return { ok };
        } catch (e: any) {
            return { err: e.stderr.toString() };
        }
    }

    async psbt_finalize(psbt: string): Promise<Result<string>> {
        return await SapioCompiler.command([
            'psbt',
            'finalize',
            '--psbt',
            psbt,
        ]);
    }

    async show_config(): Promise<Result<string>> {
        return await SapioCompiler.command(['configure', 'show']);
    }

    async list_contracts(): Promise<Result<API>> {
        const res = await SapioCompiler.command(['contract', 'list']);
        if ('err' in res) return res;
        const contracts = res.ok;
        const lines: Array<[string, string]> = contracts
            .trim()
            .split(/\r?\n/)
            .map((line: string) => {
                const v: string[] = line.split(' -- ')!;
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
            lines.map(
                ([name, key]: [string, string]): Promise<Result<string>> => {
                    if (memo_logos.has(key)) {
                        return Promise.resolve(memo_logos.get(key));
                    } else {
                        return SapioCompiler.command([
                            'contract',
                            'logo',
                            '--key',
                            key,
                        ])
                            .then((logo: Result<string>) => {
                                return 'ok' in logo
                                    ? { ok: logo.ok.trim() }
                                    : logo;
                            })
                            .then((logo: Result<string>) => {
                                if ('err' in logo) return logo;
                                memo_logos.set(key, logo);
                                return logo;
                            });
                    }
                }
            )
        );
        const [apis, logos] = await Promise.all([apis_p, logos_p]);

        const results: API = {};
        equal(lines.length, apis.length);
        equal(lines.length, logos.length);
        for (let i = 0; i < lines.length; ++i) {
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
        console.log(`child stdout:\n${JSON.stringify(child)}`);
        return { ok: null };
    }

    async create_contract(
        workspace_name: string,
        which: string,
        txn: string | null,
        args: string
    ): Promise<Result<string | null>> {
        const workspace = await SapioWorkspace.new(workspace_name);
        let create, created, bound;
        const args_h = Bitcoin.crypto.sha256(Buffer.from(args)).toString('hex');
        // Unique File Name of Time + Args + Module
        const fname = `${which.substring(0, 16)}-${args_h.substring(
            0,
            16
        )}-${new Date().getTime()}`;
        const file = await workspace.contract_output_path(fname);
        const write_str = (to: string, data: string) =>
            writeFile(path.join(file, to), data, { encoding: 'utf-8' });
        const w_arg = write_str('args.json', args);
        const w_mod = write_str(
            'module.json',
            JSON.stringify({ module: which })
        );
        const sc = await sapio.show_config();
        if ('err' in sc) return Promise.reject('Error getting config');
        const w_settings = write_str('settings.json', sc.ok);

        Promise.all([w_arg, w_mod, w_settings]);

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
        if ('err' in create) {
            write_str('create_error.json', JSON.stringify(create));
            return create;
        }
        created = create.ok;
        const w_create = write_str('create.json', create.ok);
        Promise.all([w_create]);
        let bind;
        try {
            const bind_args = ['contract', 'bind', '--base64_psbt'];
            if (txn) bind_args.push('--txn', txn);
            bind_args.push(created);
            bind = await SapioCompiler.command(bind_args);
        } catch (e: any) {
            console.debug(created);
            console.log('Failed to bind', e.toString());
            return { ok: null };
        }
        if ('err' in bind) {
            console.log(['bind'], typeof bind, bind);
            write_str('bind_error.json', JSON.stringify(bind));
            return bind;
        }
        const w_bound = write_str('bound.json', bind.ok);
        await w_bound;
        console.debug(bound);
        return bind;
    }
}

export const sapio = new SapioCompiler();

let g_emulator: null | ChildProcessWithoutNullStreams = null;
let g_emulator_log = '';

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
        const emulator = spawnSync(binary, ['emulator', 'server', seed, iface]);
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
