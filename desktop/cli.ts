import { spawn } from 'node:child_process';

export const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024;
const MAX_DIAGNOSTIC_BYTES = 64 * 1024;

export interface CommandOptions {
    input?: string;
    timeoutMs?: number;
    maxOutputBytes?: number;
}

/** No shell interpretation, inherited stdin, or renderer-provided command line. */
export function runCli(
    binary: string,
    args: readonly string[],
    options: CommandOptions = {},
): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(binary, [...args], {
            shell: false,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const output: Buffer[] = [];
        const diagnostics: Buffer[] = [];
        let outputBytes = 0;
        let diagnosticBytes = 0;
        let failure: Error | undefined;
        const stop = (message: string) => {
            failure ??= new Error(message);
            child.kill('SIGKILL');
        };
        const timer = setTimeout(
            () => stop('Sapio command exceeded its time limit.'),
            options.timeoutMs ?? 300_000,
        );
        child.stdout.on('data', (chunk: Buffer) => {
            outputBytes += chunk.length;
            if (outputBytes > (options.maxOutputBytes ?? MAX_DOCUMENT_BYTES)) {
                stop('Sapio output exceeded the document size limit.');
            } else output.push(chunk);
        });
        child.stderr.on('data', (chunk: Buffer) => {
            diagnosticBytes += chunk.length;
            if (diagnosticBytes > MAX_DIAGNOSTIC_BYTES)
                stop('Sapio diagnostics exceeded the size limit.');
            else diagnostics.push(chunk);
        });
        child.on('error', (error) => {
            failure = new Error(`Could not run Sapio: ${error.message}`);
        });
        child.stdin.on('error', (error: NodeJS.ErrnoException) => {
            // A command that rejects its arguments may close stdin before reading it.
            if (error.code !== 'EPIPE')
                stop(`Could not send input to Sapio: ${error.message}`);
        });
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            if (failure) reject(failure);
            else if (code !== 0) {
                const detail = Buffer.concat(diagnostics)
                    .toString('utf8')
                    .trim();
                reject(
                    new Error(
                        detail || `Sapio command failed (${signal ?? code}).`,
                    ),
                );
            } else resolve(Buffer.concat(output).toString('utf8').trimEnd());
        });
        if (
            options.input !== undefined &&
            Buffer.byteLength(options.input) > MAX_DOCUMENT_BYTES
        ) {
            stop('Input exceeded the document size limit.');
            child.stdin.end();
        } else child.stdin.end(options.input);
    });
}

export function documentText(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim())
        throw new Error(`${label} must contain text.`);
    if (Buffer.byteLength(value) > MAX_DOCUMENT_BYTES)
        throw new Error(`${label} exceeds the document size limit.`);
    return value;
}

export function parseDocument(value: unknown, label: string): unknown {
    const text = documentText(value, label);
    try {
        return JSON.parse(text);
    } catch (error) {
        if (error instanceof SyntaxError)
            throw new Error(`${label} is not valid JSON: ${error.message}`);
        throw error;
    }
}

export function object(value: unknown, label: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new Error(`${label} must be an object.`);
    return value as Record<string, unknown>;
}

export function index(value: unknown, label = 'Input index'): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
        throw new Error(`${label} must be a nonnegative integer.`);
    return value;
}
