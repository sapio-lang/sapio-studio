import { app, BrowserWindow } from 'electron';
import path from 'path';
import url from 'url';
import { custom_sapio_config } from './settings';

import { createMenu } from './createMenu';
import register_handlers from './handlers';
import { SapioWorkspace, start_sapio_oracle } from './sapio';
import { register_devtools } from './devtools';
import { get_bitcoin_node } from './bitcoin_rpc';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
    await get_bitcoin_node();
    await SapioWorkspace.new('default');
    const startUrl =
        process.env.ELECTRON_START_URL ||
        url.format({
            pathname: path.join(__dirname, '../index.html'),
            protocol: 'file:',
            slashes: true,
        });
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        frame: false,
        backgroundColor: 'black',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            allowRunningInsecureContent: false,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow && mainWindow.show();
    });
    mainWindow.loadURL(startUrl);
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
    createMenu(mainWindow);
    register_handlers(mainWindow);
    custom_sapio_config();
    start_sapio_oracle();
}
register_devtools();

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});
