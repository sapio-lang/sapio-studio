import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

/** The native save dialog has already selected the destination and overwrite. */
export async function exportDocument(
    file: string,
    text: string,
): Promise<void> {
    const handle = await open(
        file,
        constants.O_WRONLY | constants.O_CREAT,
        0o600,
    );
    try {
        // Opening an existing file does not apply the creation mode. Restrict
        // its permissions before replacing any contents with spend data.
        await handle.chmod(0o600);
        await handle.truncate(0);
        await handle.writeFile(text);
    } finally {
        await handle.close();
    }
}
