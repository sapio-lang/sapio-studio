import { Worker } from 'node:worker_threads';
import path from 'node:path';
import type { BridgeReply, JsonSchema, JsonValue } from '../shared/studio';
import { MAX_DOCUMENT_BYTES } from './cli';

type ValidationResult = { valid: boolean; errors: string[] };

/** The fixed worker isolates plugin-supplied schema compilation and patterns. */
export async function validateValue(
    schema: JsonSchema,
    value: JsonValue,
    workerFile: string,
): Promise<ValidationResult> {
    const request = JSON.stringify({ schema, value });
    if (Buffer.byteLength(request) > MAX_DOCUMENT_BYTES) {
        throw new Error(
            'Schema and document exceed the 32 MiB validation limit.',
        );
    }
    if (!path.isAbsolute(workerFile))
        throw new Error(
            'Schema worker must have an absolute application path.',
        );
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerFile, {
            execArgv: [],
            resourceLimits: {
                maxOldGenerationSizeMb: 128,
                maxYoungGenerationSizeMb: 16,
                stackSizeMb: 4,
            },
        });
        const timer = setTimeout(() => {
            void worker.terminate();
            reject(
                new Error(
                    'Schema validation exceeded its 10-second time limit.',
                ),
            );
        }, 10_000);
        worker.once('message', (reply: BridgeReply<ValidationResult>) => {
            clearTimeout(timer);
            void worker.terminate();
            if (reply.ok) resolve(reply.value);
            else
                reject(
                    new Error(
                        `Module schema validation failed: ${reply.error}`,
                    ),
                );
        });
        worker.once('error', (error) => {
            clearTimeout(timer);
            void worker.terminate();
            reject(
                new Error(`Schema validation worker failed: ${error.message}`),
            );
        });
        worker.once('exit', (code) => {
            clearTimeout(timer);
            // A completed result already settled the promise before termination.
            reject(
                new Error(
                    `Schema validation worker exited before returning a result (${code}).`,
                ),
            );
        });
        worker.postMessage(request);
    });
}
