const { app, Menu } = require('electron');
const ElectronPreferences = require('electron-preferences');
const { settings } = require('./settings');
const { dialog } = require('electron');
const { load_contract_file_name, list_contracts } = require('./sapio');


function createMenu(window) {

    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Contract From Clipboard',
                    click() {
                        window.webContents.send('load_hex', true);
                    }
                },
                {
                    label: 'View Contract Hex',
                    click() {
                        window.webContents.send('save_hex', true);
                    }
                },
                { label: 'Open Contract From File' },
                {
                    label: 'Load WASM Plugin',
                    click() {
                        const plugin = dialog.showOpenDialogSync({ properties: ['openFile'], filters: [{ "extensions": ["wasm"], name: "WASM" }] });
                        load_contract_file_name(plugin);
                    }
                },
                {
                    label: 'Create New Contract',
                    async click() {
                        const contracts = await list_contracts();
                        window.webContents.send('create_contracts', contracts);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Preferences',
                    click() {
                        settings.show();
                    }

                }
            ]
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
                { role: 'selectall' }
            ]
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
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Bitcoin Node',
            submenu: [
                { label: 'Connect' },
            ]
        },
        {
            label: "Simulate",
            submenu: [
                {
                    label: "Timing",
                    click() {
                        window.webContents.send('simulate', 'timing');
                    }
                }
            ]

        },
        {
            role: 'window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click() { require('electron').shell.openExternal('https://electronjs.org'); }
                }
            ]
        }
    ];

    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services', submenu: [] },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });

        // Edit menu
        template[2].submenu.push(
            { type: 'separator' },
            {
                label: 'Speech',
                submenu: [
                    { role: 'startspeaking' },
                    { role: 'stopspeaking' }
                ]
            }
        );

        // Window menu
        template[6].submenu = [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' }
        ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

module.exports = createMenu;