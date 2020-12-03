const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow;

function createWindow() {
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
            nodeIntegration: true,
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

const Client = require('bitcoin-core');

const client = new Client({
    network: 'regtest',
    username: 'btcusr',
    password:
        '261299cf4f162e6d8e870760ee88b29537617c6aadc45f5ffd249b2309ca47fd',
});
ipcMain.handle('bitcoin-command', async (event, arg) => {
    let result = await client.command(arg);
    return result;
});
