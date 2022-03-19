import { app, BrowserWindow, clipboard, Menu, shell } from 'electron';
import { dialog } from 'electron';
import { sapio } from './sapio';
import Client from 'bitcoin-core-ts';
import { readFileSync } from 'fs';

export function createMenu(window: BrowserWindow) {
    const template = [
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
        template[3]!.submenu = [
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
