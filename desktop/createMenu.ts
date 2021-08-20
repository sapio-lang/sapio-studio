import { app, BrowserWindow, clipboard, Menu, shell } from 'electron';
import { settings } from './settings';
import { dialog } from 'electron';
import { sapio } from './sapio';
import Client from 'bitcoin-core';
import { readFileSync } from 'fs';

export function createMenu(window: BrowserWindow, client: typeof Client) {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Contract From Clipboard',
                    click() {
                        window.webContents.send('load_hex', true);
                    },
                },
                {
                    label: 'Save Contract',
                    click() {
                        window.webContents.send('save_hex', true);
                    },
                },
                {
                    label: 'Open Contract From File',

                    click() {
                        const file = dialog.showOpenDialogSync(window, {
                            properties: ['openFile'],
                            filters: [{ extensions: ['json'], name: 'Sapio Contract Object' }],
                        });
                        if (file && file.length) {
                            const data = readFileSync(file[0], { encoding: 'utf-8' });
                            window.webContents.send("load_contract", data);

                        }
                    },
                },
                {
                    label: 'Load WASM Plugin',
                    click() {
                        const plugin = dialog.showOpenDialogSync({
                            properties: ['openFile'],
                            filters: [{ extensions: ['wasm'], name: 'WASM' }],
                        });
                        sapio.load_contract_file_name(plugin![0]);
                    },
                },
                {
                    label: 'Create New Contract',
                    async click() {
                        const contracts = await sapio.list_contracts();
                        window.webContents.send('create_contracts', contracts);
                    },
                },
                {
                    label: 'Recreate Last Contract',
                    id: 'file-contract-recreate',
                    async click() {
                        sapio.recreate_contract(window);
                    },
                    enabled: false,
                },
                { type: 'separator' },
                {
                    label: 'Preferences',
                    click() {
                        settings.show();
                    },
                },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'pasteandmatchstyle' },
                { role: 'delete' },
                { role: 'selectall' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { role: 'toggledevtools' },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Bitcoin Node',
            submenu: [
                {
                    label: 'Toggle Node Bar',
                    async click() {
                        window.webContents.send('bitcoin-node-bar', 'show');
                    },
                },
                {
                    label: 'Create New Address to Clipboard',
                    async click() {
                        let result = await client.command('getnewaddress');
                        clipboard.writeText(result);
                    },
                },
            ],
        },
        {
            label: 'Simulate',
            submenu: [
                {
                    label: 'Timing',
                    click() {
                        window.webContents.send('simulate', 'timing');
                    },
                },
            ],
        },
        {
            role: 'window',
            submenu: [{ role: 'minimize' }, { role: 'close' }],
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click() {
                        shell.openExternal('https://electronjs.org');
                    },
                },
            ],
        },
    ];

    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        });

        // Edit menu
        /*
        template[2].submenu.push({ type: 'separator' }, {
            label: 'Speech',
            submenu: [
                { role: 'startspeaking' },
                { role: 'stopspeaking' }
            ]
        });
        */

        // Window menu
        template[6].submenu = [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
        ];
    }

    const menu = Menu.buildFromTemplate(template as any);
    Menu.setApplicationMenu(menu);
}
