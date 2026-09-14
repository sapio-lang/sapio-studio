import { app, BrowserWindow, dialog, session } from 'electron';
import path from 'node:path';
import { registerStudioHandlers } from './studio-handlers';

let window: BrowserWindow | null = null;

async function createWindow() {
    const requestedDevUrl = !app.isPackaged
        ? process.env.STUDIO_DEV_SERVER_URL
        : undefined;
    if (requestedDevUrl && requestedDevUrl !== 'http://127.0.0.1:5173')
        throw new Error(
            'Studio development server must use http://127.0.0.1:5173.',
        );
    const devUrl = requestedDevUrl;
    const policy = [
        "default-src 'self'",
        `script-src 'self'${devUrl ? " 'unsafe-inline'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        `connect-src 'self'${devUrl ? ' ws://127.0.0.1:5173' : ''}`,
        "object-src 'none'",
        "base-uri 'none'",
        "frame-src 'none'",
        "form-action 'none'",
    ].join('; ');
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [policy],
            },
        });
    });
    session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    window = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 900,
        minHeight: 640,
        show: false,
        title: 'Sapio Studio',
        backgroundColor: '#f4f3ef',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
    });
    const current = window;
    const unregister = registerStudioHandlers(
        current,
        path.join(__dirname, devUrl ? '../../public/demo' : '../renderer/demo'),
    );
    current.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    current.webContents.on('will-navigate', (event) => event.preventDefault());
    current.webContents.on('will-attach-webview', (event) =>
        event.preventDefault(),
    );
    current.once('ready-to-show', () => current.show());
    current.on('closed', () => {
        unregister();
        window = null;
    });
    if (devUrl) await current.loadURL(devUrl);
    else await current.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady()
    .then(async () => {
        await createWindow();
        app.on('activate', () => {
            if (window === null) void createWindow();
        });
    })
    .catch((error: unknown) => {
        dialog.showErrorBox(
            'Sapio Studio could not start',
            error instanceof Error ? error.message : String(error),
        );
        app.quit();
    });
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
