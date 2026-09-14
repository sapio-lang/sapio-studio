import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';
import './build-desktop.mjs';

const server = await createServer();
await server.listen();
server.printUrls();
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const desktop = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: { ...environment, STUDIO_DEV_SERVER_URL: 'http://127.0.0.1:5173' },
});
desktop.on('error', async (error) => {
    console.error(error.message);
    await server.close();
    process.exitCode = 1;
});
desktop.on('exit', async (code) => {
    await server.close();
    process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => desktop.kill(signal));
}
