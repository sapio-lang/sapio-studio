import electron, { dialog } from 'electron';
const app = electron.app;
import path from 'path';
import { writeFileSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { default_settings } from './settings_gen';
import { deinit_bitcoin_node, get_bitcoin_node } from './bitcoin_rpc';
import { kill_emulator, start_sapio_oracle } from './sapio';

export type Prefs = 'bitcoin' | 'display' | 'local_oracle' | 'sapio_cli';
const pref_array: Array<Prefs> = [
    'bitcoin',
    'display',
    'local_oracle',
    'sapio_cli',
];

type DisplaySettings = {
    animation_speed: 'Disabled' | { Enabled: number };
    node_polling_freq: number;
    satoshis:
        | { BitcoinAfter: number }
        | { AlwaysSats: null }
        | { AlwaysBitcoin: null };
};

function fill_in_default(): Data {
    const defaults = JSON.parse(JSON.stringify(default_settings));
    const username = process.env.SAPIO_BITCOIN_RPC_USER;
    const password = process.env.SAPIO_BITCOIN_RPC_PASSWORD;
    const port = process.env.SAPIO_BITCOIN_RPC_PORT;
    const host = process.env.SAPIO_BITCOIN_HOST;
    const network = process.env.SAPIO_BITCOIN_NETWORK;
    if (username && password)
        defaults.bitcoin.auth = { UserPass: [username, password] };
    if (port) defaults.bitcoin.port = port;
    if (host) defaults.bitcoin.host = host;
    /// TODO: remove, for compat with sapio-pod
    if (network && network.length >= 1)
        defaults.bitcoin.network =
            network ===
            ('mainnet'
                ? 'Bitcoin'
                : network[0]!.toUpperCase() + network.substring(1));

    const seed = process.env.SAPIO_ORACLE_SEED_FILE;
    const iface = process.env.SAPIO_ORACLE_NET;
    if (seed && iface)
        defaults.preferences.local_oracle = {
            Enabled: { file: seed, interface: iface },
        };

    const binary = process.env.SAPIO_CLI_BINARY;
    if (binary) defaults.preferences.sapio_cli.sapio_cli = binary;
    const config = process.env.SAPIO_CLI_CONFIGURED_BY;
    if (config) defaults.preferences = { File: config };
    return defaults;
}

type Data = {
    bitcoin: {
        auth: { None: null } | { UserPass: string[] } | { CookieFile: string };
        host: string;
        network: 'Signet' | 'Bitcoin' | 'Regtest' | 'Testnet';
        port: number;
    };
    sapio_cli: {
        preferences:
            | {
                  Here: {
                      emulators: [string, string][];
                      plugin_map: [string, string][];
                      threshold: number;
                      use_emulation: boolean;
                  };
              }
            | { File: string }
            | 'Default';
        sapio_cli: string;
    };
    display: DisplaySettings;
    local_oracle: 'Disabled' | { Enabled: { file: string; interface: string } };
};
export const preferences: {
    data: Data;
    save: (which: Prefs, data: object) => Promise<boolean>;
    load_preferences: (which: Prefs) => Promise<void>;
    initialize: () => Promise<void>;
} = {
    data: fill_in_default(),
    initialize: async () => {
        for (const key of pref_array)
            try {
                await preferences.load_preferences(key);
            } catch {}
    },
    save: async (which: Prefs, data: object) => {
        const conf = path.resolve(
            app.getPath('userData'),
            which + '_preferences.json'
        );
        switch (which) {
            case 'bitcoin':
            case 'display':
            case 'local_oracle':
            case 'sapio_cli':
                await writeFile(conf, JSON.stringify(data));
                await preferences.load_preferences(which);
                await custom_sapio_config();
                break;
            default:
                return Promise.reject('Bad Request');
        }

        switch (which) {
            case 'bitcoin':
                deinit_bitcoin_node();
                get_bitcoin_node();
                break;
            case 'local_oracle':
                kill_emulator();
                start_sapio_oracle();
                break;
        }
        return true;
    },
    load_preferences: async (which: Prefs) => {
        const conf = path.resolve(
            app.getPath('userData'),
            which + '_preferences.json'
        );
        preferences.data[which] = JSON.parse(
            await readFile(conf, { encoding: 'utf-8' })
        );
    },
};

// Use blocking to ensure sync
export const sapio_config_file = path.join(
    app.getPath('temp'),
    'custom_sapio_config.json'
);
let memo_data = '';
export const custom_sapio_config = () => {
    if (preferences.data.sapio_cli.preferences === 'Default') return;
    if (!('Here' in preferences.data.sapio_cli.preferences)) return;
    let network = preferences.data.bitcoin.network.toLowerCase();
    if (network === 'bitcoin') network = 'main';
    const auth = preferences.data.bitcoin.auth;
    const port = preferences.data.bitcoin.port;
    const host = preferences.data.bitcoin.host;
    const oracle_enabled = preferences.data.local_oracle !== 'Disabled';
    const conf = preferences.data.sapio_cli.preferences.Here;
    const threshold: number = conf.threshold;

    let error = false;
    const oracle_list = conf.emulators;
    const plugin_map: Record<string, string> = {};
    for (const [key, hash] of conf.plugin_map) {
        if (hash.length != 64) {
            dialog.showErrorBox(
                'Setting Error:',
                'Incorrect length key ' + hash
            );
            error = true;
            return;
        }
        if (plugin_map.hasOwnProperty(key)) {
            dialog.showErrorBox('Setting Error:', 'Duplicate key ' + name);
            error = true;
            return;
        }
        plugin_map[key] = hash;
    }
    console.log(plugin_map);
    if (error) return;
    const data = JSON.stringify({
        main: null,
        testnet: null,
        signet: null,
        regtest: null,
        // overwrites earlier keys...
        [network]: {
            active: true,
            api_node: {
                url: 'http://' + host + ':' + port,
                auth: auth,
            },
            emulator_nodes: {
                enabled: oracle_enabled,
                emulators: oracle_list,
                threshold: threshold ?? 0,
            },
            plugin_map: plugin_map,
        },
    });
    if (memo_data !== data) {
        memo_data = data;
        console.info('Writing Sapio Setting to ', sapio_config_file, data);
        writeFileSync(sapio_config_file, data);
    }
};
