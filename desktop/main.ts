import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import url from 'url';
import { custom_sapio_config, settings } from './settings';

import Client from 'bitcoin-core';

import { createMenu } from './createMenu';
import register_handlers from './handlers';
import { start_sapio_oracle } from './sapio';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { sys } from 'typescript';

export let client = null;
let mainWindow: BrowserWindow | null = null;

function load_settings() {
    const network = settings.value('bitcoin-config.network');
    const username = settings.value('bitcoin-config.rpcuser');
    const password = settings.value('bitcoin-config.rpcpassword');
    const port = settings.value('bitcoin-config.rpcport');
    const host = settings.value('bitcoin-config.rpchost');

    client = new Client({
        network,
        username,
        password,
        port,
        host,
    });
}

function createWindow() {
    load_settings();
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
        backgroundColor: 'black',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            allowRunningInsecureContent: false,
            contextIsolation: true,
            enableRemoteModule: false,
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
    createMenu(mainWindow, client);
    register_handlers(mainWindow, client);
    custom_sapio_config();
    let emulator = start_sapio_oracle();
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
            console.log(`stdout: ${data}`);
        });
    }
}

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
