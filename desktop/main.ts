import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import url from 'url';
import { custom_sapio_config, preferences } from './settings';

import Client from 'bitcoin-core';

import { createMenu } from './createMenu';
import register_handlers from './handlers';
import { start_sapio_oracle } from './sapio';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { sys } from 'typescript';
import { register_devtools } from './devtools';
import { readFile } from 'fs/promises';

export let client = null;
let mainWindow: BrowserWindow | null = null;

async function load_settings() {
    await preferences.initialize();
    let network = preferences.data.bitcoin.network.toLowerCase();
    if (network === 'bitcoin') network = 'mainnet';
    const port = preferences.data.bitcoin.port;
    const host = preferences.data.bitcoin.host;
    let split: string[];
    if ('Cookie' in preferences.data.bitcoin.auth) {
        const cookie = preferences.data.bitcoin.auth.Cookie;
        let upw = await readFile(cookie, { encoding: 'utf-8' });
        split = upw.split(':');
    } else if ('UserPass' in preferences.data.bitcoin.auth) {
        split = preferences.data.bitcoin.auth.UserPass;
    } else {
        console.log('BROKEN');
        client = new Client({
            network,
            port,
            host,
        });
        return;
    }
    if (split.length === 2) {
        let username = split[0] ?? '';
        let password = split[1] ?? '';
        client = new Client({
            network,
            username,
            password,
            port,
            host,
        });
    } else {
        throw Error('Malformed Cookie File');
    }
}

async function createWindow() {
    await load_settings();
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
