import electron from 'electron';
const app = electron.app;
import path from 'path';
import os from 'os';
import ElectronPreferences from 'electron-preferences';
import { Menu } from 'electron';

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
            'oracle-local-enabled':[]
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
                        label: 'sapio-cli',
                        fields: [
                            {
                                label: 'sapio-cli binary',
                                key: 'binary',
                                type: 'file',
                                help: 'the sapio-cli binary to use',
                                dontAddToRecent: true,
                            },
                            {
                                label: 'Override Configuration File?',
                                key: 'configfile',
                                type: 'file',
                                help:
                                    'if specified, to use the default file or not',
                                dontAddToRecent: true,
                            },
                        ],
                    },
                    {
                        label: 'oracle-server',
                        fields: [
                            {
                                label: "create local emulator",
                                key: "oracle-local-enabled",
                                type:'checkbox',
                                'options': [
									{ 'label': 'Launch on Startup', 'value': 'oracle-launch_on_startup' },
                                ]
                            },
                            {
                                label: 'seed file',
                                key: 'oracle-seed-file',
                                type: 'file',
                                help: 'the file containing the seed for this oracle',
                                dontAddToRecent: true,
                            },
                            {
                                label: 'network interface',
                                key: 'oracle-netinterface',
                                type: 'text',
                                help: 'if set, wheather to run a local oracle',
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
