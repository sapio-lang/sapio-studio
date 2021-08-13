const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { settings } = require("./settings");
const { list_contracts, } = require("./sapio");

let mainWindow;
let Client = require('bitcoin-core');

const createMenu = require('./createMenu.js');
const register_handlers = require('./handlers.js');
const ElectronPreferences = require('electron-preferences');

let client = new Client();
exports.client = client;
function load_settings() {
    const udata = app.getPath('userData');
    const config = path.join(udata, 'config.json');
    if (!fs.existsSync(udata)) {
        let dir = fs.mkdirSync(udata);
    }

    if (!fs.existsSync(config)) {
        let f = fs.openSync(config, 'wx+');
        let settings = JSON.stringify({
            clients: [
                {
                    nickname: 'default',
                    network: 'regtest',
                    username: 'btcusr',
                    password:
                        '261299cf4f162e6d8e870760ee88b29537617c6aadc45f5ffd249b2309ca47fd',
                },
            ],
        });
        fs.writeSync(f, settings);
    }
    let data = fs.readFileSync(config);
    const settings = JSON.parse(data);
    const default_client = settings['clients'][0];
    client = new Client({
        network: default_client['network'],
        username: default_client['username'],
        password: default_client['password'],
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
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
    createMenu(mainWindow);
    register_handlers(client);

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