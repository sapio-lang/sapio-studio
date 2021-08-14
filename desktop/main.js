const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { settings } = require("./settings");

let mainWindow;
let Client = require('bitcoin-core');

const { createMenu } = require('./createMenu.js');
const register_handlers = require('./handlers.js');
const ElectronPreferences = require('electron-preferences');

let client = new Client();
exports.client = client;

function load_settings() {
    const network = settings.value("bitcoin-config.network");
    const username = settings.value("bitcoin-config.rpcuser");
    const password = settings.value("bitcoin-config.rpcpassword");
    const port = settings.value("bitcoin-config.rpcport");
    const host = settings.value("bitcoin-config.rpchost");

    client = new Client({
        network,
        username,
        password,
        port,
        host
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
    mainWindow.location = startUrl;
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    mainWindow.loadURL(startUrl);
    mainWindow.on('closed', function() {
        mainWindow = null;
    });
    createMenu(mainWindow);
    register_handlers(client);

}

app.on('ready', createWindow);

app.on('window-all-closed', function() {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function() {
    if (mainWindow === null) {
        createWindow();
    }
});