import { parentPort } from 'node:worker_threads';
import type { BridgeReply, JsonSchema, JsonValue } from '../shared/studio';
import { validateSchema } from './schema-validation';

if (!parentPort)
    throw new Error('Schema validation requires its worker channel.');
const port = parentPort;
port.once('message', (request: string) => {
    let reply: BridgeReply<ReturnType<typeof validateSchema>>;
    try {
        const { schema, value } = JSON.parse(request) as {
            schema: JsonSchema;
            value: JsonValue;
        };
        reply = { ok: true, value: validateSchema(schema, value) };
    } catch (error) {
        reply = {
            ok: false,
            error:
                error instanceof Error
                    ? error.message
                    : 'Schema validation failed.',
        };
    }
    port.postMessage(reply);
});
