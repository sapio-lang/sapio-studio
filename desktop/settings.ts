import electron, { dialog } from 'electron';
const app = electron.app;
import path from 'path';
import os from 'os';
import ElectronPreferences from 'electron-preferences';
import { Menu } from 'electron';
import { open, writeFileSync } from 'fs';


export const settings = new ElectronPreferences({
    /**
     * Where should preferences be saved?
     */
    dataStore: path.resolve(app.getPath('userData'), 'preferences.json'),
    /**
     * Default values.
     */
    defaults: {
        sapio: {
            binary: path.resolve(os.homedir(), 'sapio/target/debug/sapio-cli'),
            'oracle-local-enabled': false,
            'oracle-remote-enabled': false,
            'oracle-remote-oracles-list': [],
            'oracle-remote-threshold': [],
            plugin_map: {},
            configsource: "default"
        },
        display: {
            'sats-bound': 9_999_999,
            'animate-flow': 500,
        }
    },
    /**
     * The preferences window is divided into sections. Each section has a label, an icon, and one or
     * more fields associated with it. Each section should also be given a unique ID.
     */
    sections: [
        {
            id: 'sapio',
            label: 'Sapio Settings',
            icon: 'settings-gear-63',
            form: {
                groups: [
                    {
                        label: 'Configure and select sapio-cli',
                        fields: [
                            {
                                label: 'Binary for sapio-cli',
                                key: 'binary',
                                type: 'file',
                                help: "The sapio-cli binary to use. Release build highly recommended for performance",
                                dontAddToRecent: true,
                            },
                            {
                                label: 'Preferences From',
                                help: "Where should sapio-cli read preferences from",
                                key: 'configsource',
                                type: 'radio',
                                options: [
                                    { label: "Default", value: "default" },
                                    { label: "Specific File", value: "file" },
                                    { label: "Configured Here", value: "here" }
                                ]
                            },
                            {
                                label: 'Override Default Configuration File?',
                                key: 'configfile',
                                type: 'file',
                                help: "If specified, to use the default file or one selected here.",
                                dontAddToRecent: true,
                            },
                            {
                                label: 'Custom Plugin Mapping',
                                key: 'plugin_map',
                                type: 'list',
                                size: 10,
                                style: {
                                    width: '75%'
                                },
                                help: 'Format is: api_name api_hash',
                                orderable: true
                            }
                        ],
                    },
                    {
                        label: 'Local Oracle Server:',
                        help: "When set up, will enable a local oracle server",
                        fields: [
                            {
                                label: "Local Emulator Enable?",
                                help: 'Run a local oracle on startup when checked.',
                                key: "oracle-local-enabled",
                                type: 'radio',
                                options: [
                                    { label: 'Launch on Startup', value: true },
                                    { label: 'Do Not Launch', value: false },
                                ]
                            },
                            {
                                label: 'Seed File',
                                help: 'The file containing the seed for this oracle. If you do not have one, try ' +
                                    "`head -n 4096 /dev/urandom | shasum -a 256 > SAPIO_ORACLE_SEED`",
                                key: 'oracle-seed-file',
                                type: 'file',
                                dontAddToRecent: true,
                            },
                            {
                                label: 'Network Interface',
                                help: "What interface to bind (e.g. 0.0.0.0:8080)",
                                key: 'oracle-netinterface',
                                type: 'text',
                            },
                        ]
                    },
                    {
                        label: 'Remote Oracle Servers:',
                        help: "Servers to contact for remote sapio emulation",
                        fields: [
                            {
                                label: "Sapio Remote Emulators Enabled",
                                key: "oracle-remote-enabled",
                                type: 'radio',
                                options: [
                                    { label: 'Use CTV Emulation', value: true },
                                    { label: 'No CTV Emulation', value: false },
                                ],
                                help: "Should compilation target OP_CHECKTEMPLATEVERIFY or Oracle Emultation"

                            },
                            {
                                label: "Emulator Trust Threshold",
                                key: "oracle-remote-threshold",
                                type: 'text',
                                inputType: "number",
                                min: 0,
                                max: 255,
                            },
                            {
                                'label': 'Oracles to Use',
                                'key': 'oracle-remote-oracles-list',
                                'type': 'list',
                                'size': 10,
                                'style': {
                                    'width': '75%'
                                },
                                'help': 'Format is:   host:port pubkey',
                                'orderable': true
                            },
                        ],
                    },

                ],
            },
        },
        {
            id: 'display',
            label: 'Display Settings',
            icon: 'eye-19',
            form: {
                groups: [
                    {
                        label: 'Units',
                        fields: [
                            {
                                label:
                                    'Satoshis / Bitcoin Threshold in Sats (§)',
                                key: 'sats-bound',
                                type: 'text',
                                inputType: 'number',
                                help: 'The level at which to show sats or btc',
                            },
                        ],
                    },
                    {
                        label: 'Animation',
                        fields: [
                            {
                                label: 'Coin Flow Animation Speed in milliseconds (0 to disable)',
                                key: 'animate-flow',
                                'type': 'slider',
                                'min': 0,
                                'max': 5000,
                                help: 'To use the visualizer or not',
                            },
                        ],
                    },
                ],
            },
        },
        {
            id: 'bitcoin-config',
            label: 'Bitcoin Node',
            icon: 'notes',
            form: {
                groups: [
                    {
                        label: 'Node Setup',
                        fields: [
                            {
                                label: 'rpc user',
                                key: 'rpcuser',
                                type: 'text',
                                help: 'rpc user name',
                            },
                            {
                                label: 'rpc password',
                                key: 'rpcpassword',
                                type: 'text',
                                help: 'rpc password',
                                inputType: 'password',
                            },
                            {
                                label: 'rpc port',
                                key: 'rpcport',
                                type: 'text',
                                help: 'rpc port',
                                inputType: 'number',
                            },
                            {
                                label: 'rpc host',
                                key: 'rpchost',
                                type: 'text',
                                help: 'rpc host',
                            },
                            {
                                label: 'Network',
                                key: 'network',
                                type: 'radio',
                                options: [
                                    { label: 'Main', value: 'mainnet' },
                                    { label: 'Regtest', value: 'regtest' },
                                    { label: 'Testnet', value: 'testnet' },
                                    { label: 'Signet', value: 'signet' },
                                ],
                                help: 'Which network to use?',
                            },
                        ],
                    },
                ],
            },
        },
    ],
    /**
     * These parameters on the preference window settings can be overwrinten
     */
    browserWindowOpts: {
        title: 'My custom preferences title',
        width: 900,
        maxWidth: 1000,
        height: 700,
        maxHeight: 1000,
        resizable: true,
        maximizable: false,
        //...
    },
    /**
     * These parameters create an optional menu bar
     */
    menu: Menu.buildFromTemplate([
        {
            label: 'Window',
            role: 'window',
            submenu: [
                {
                    label: 'Close',
                    accelerator: 'CmdOrCtrl+W',
                    role: 'close',
                },
            ],
        },
    ]),
});

// Use blocking to ensure sync
export const sapio_config_file = path.join(app.getPath("temp"), "custom_sapio_config.json");
let memo_data = "";
export const custom_sapio_config = () => {
    let network = settings.value('bitcoin-config.network');
    if (network === "mainnet") network = "main";
    const username = settings.value('bitcoin-config.rpcuser');
    const password = settings.value('bitcoin-config.rpcpassword');
    const port = settings.value('bitcoin-config.rpcport');
    const host = settings.value('bitcoin-config.rpchost');
    const oracle_enabled = settings.value("sapio.oracle-remote-enabled");
    const threshold = parseInt(settings.value("sapio.oracle-remote-threshold"));
    let error = false;
    const oracle_list = settings.value("sapio.oracle-remote-oracles-list").map((line: string) => {
        let opts = line.trim().split(" ");
        if (opts.length != 2) {
            dialog.showErrorBox("Setting Error:", "Improperly Formatted Setting for Sapio Oracle List " + line);
            error = true;
            return;
        }
        return [opts[1].trim(), opts[0].trim()];
    });
    let plugin_map: Record<string, string> = {};
    settings.value("sapio.plugin_map").forEach((line: string) => {
        let opts = line.trim().split(" ");
        if (opts.length != 2) {
            dialog.showErrorBox("Setting Error:", "Improperly Formatted Setting for Sapio Plugin Map" + line);
            error = true;
            return;
        }
        let name = opts[0].trim();
        let hash = opts[1].trim();
        if (hash.length != 64) {
            dialog.showErrorBox("Setting Error:", "Incorrect length key " + hash);
            error = true;
            return;

        }
        if (plugin_map.hasOwnProperty(name)) {
            dialog.showErrorBox("Setting Error:", "Duplicate key " + name);
            error = true;
            return;
        }
        plugin_map[name] = hash;
    });
    console.log(plugin_map);
    if (error) return;
    const data = JSON.stringify({
        "main": null,
        "testnet": null,
        "signet": null,
        "regtest": null,
        // overwrites earlier keys...
        [network]: {
            "active": true,
            "api_node": {
                "url": "http://" + host + ":" + port,
                "auth": {
                    "UserPass": [username, password],
                }
            },
            "emulator_nodes": {
                "enabled": oracle_enabled,
                "emulators": oracle_list,
                "threshold": threshold
            },
            "plugin_map": plugin_map
        }
    });
    if (memo_data !== data) {
        memo_data = data;
        console.info("Writing Sapio Setting to ", sapio_config_file, data);
        writeFileSync(sapio_config_file, data);
    }

};
settings.on('save', (_: any) => {
    custom_sapio_config();
});