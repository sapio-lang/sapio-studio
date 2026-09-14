// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runCli } from './cli';

describe('CLI process boundary', () => {
    it('passes stdin and arguments literally without interpreting a shell', async () => {
        const value = 'a module with spaces; literal $NAME';
        const output = await runCli(
            process.execPath,
            [
                '-e',
                'process.stdin.on("data", x => process.stdout.write(JSON.stringify([process.argv[1], x.toString()])));',
                value,
            ],
            { input: 'original document\n' },
        );
        expect(JSON.parse(output)).toEqual([value, 'original document\n']);
    });
    it('reports failure instead of treating stdout as a successful result', async () => {
        await expect(
            runCli(process.execPath, [
                '-e',
                'process.stdout.write("partial"); process.stderr.write("predicate rejected"); process.exitCode = 1;',
            ]),
        ).rejects.toThrow('predicate rejected');
    });
    it('bounds subprocess output and elapsed time', async () => {
        await expect(
            runCli(
                process.execPath,
                ['-e', 'process.stdout.write("123456789");'],
                { maxOutputBytes: 4 },
            ),
        ).rejects.toThrow('size limit');
        await expect(
            runCli(process.execPath, ['-e', 'setInterval(() => {}, 1000);'], {
                timeoutMs: 30,
            }),
        ).rejects.toThrow('time limit');
    });
    it('reports a missing binary without an unhandled spawn error', async () => {
        await expect(
            runCli('/missing/sapio-cli', ['--version']),
        ).rejects.toThrow('Could not run Sapio');
    });
});
