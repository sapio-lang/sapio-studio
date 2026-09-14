import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function launchDesktop(directory: string, cli: string) {
    const environment = { ...process.env };
    delete environment.ELECTRON_RUN_AS_NODE;
    return electron.launch({
        args: [
            ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
            path.resolve('tests/ui/desktop-entry.cjs'),
        ],
        env: {
            ...environment,
            STUDIO_TEST_USER_DATA: directory,
            SAPIO_CLI_BINARY: cli,
        },
    });
}

test('the production desktop inspects a real artifact without Bitcoin or CLI configuration', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'studio-desktop-'));
    const application = await launchDesktop(
        directory,
        path.join(directory, 'missing-sapio-cli'),
    );
    try {
        const page = await application.firstWindow();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await expect(
            page.getByLabel('Sapio Studio', { exact: true }),
        ).toBeVisible();
        expect(
            await page.evaluate(
                () => typeof (globalThis as Record<string, unknown>).require,
            ),
        ).toBe('undefined');
        expect(await page.evaluate(() => Boolean(window.studio))).toBe(true);
        await page
            .getByRole('button', { name: /Explore a real contract/ })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Payment contract' }),
        ).toBeVisible();
        await expect(page.locator('.output-node')).toHaveCount(3);
        await expect(page.locator('.template-node.suggested')).toHaveCount(1);
        await page.locator('.template-node').click();
        await expect(
            page.getByRole('heading', { name: 'Transaction template' }),
        ).toBeVisible();
        await page.screenshot({
            path: 'test-results/studio-inspect.png',
            fullPage: true,
        });
        await page.getByRole('button', { name: /Studio settings/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.getByRole('tab', { name: 'Patch', exact: true }).click();
        await page.getByRole('tab', { name: /^Inspect/ }).click();
        await expect(
            page.getByRole('heading', { name: 'Transaction template' }),
        ).toBeVisible();
        expect(errors).toEqual([]);
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});

test('a saved visual patch runs real nested WASM and clears edited results', async () => {
    test.skip(
        !process.env.SAPIO_CLI,
        'Set SAPIO_CLI for the real module workflow; the Sapio CI job supplies it.',
    );
    test.setTimeout(240_000);
    const directory = await mkdtemp(path.join(tmpdir(), 'studio-patch-'));
    const patchFile = path.join(directory, 'clause.patch.json');
    let application = await launchDesktop(directory, process.env.SAPIO_CLI!);
    try {
        let page = await application.firstWindow();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const example = page.getByRole('button', {
            name: /Open example patch/,
        });
        await expect(example).toBeEnabled({ timeout: 30_000 });
        await example.click();
        await expect(
            page.locator('.global-message[role="status"]'),
        ).toHaveCount(0, { timeout: 120_000 });
        await page.screenshot({
            path: 'test-results/studio-patch-loaded.png',
            fullPage: true,
        });
        await expect(page.locator('.patch-module')).toHaveCount(2);
        const reference = page.getByLabel(
            'Module reference; compatibility is checked when Sapio calls it.',
            { exact: true },
        );
        await reference.focus();
        await reference.press('Enter');
        await expect(reference).toHaveClass(/\bselected\b/);
        await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);
        await reference.press('Delete');
        await expect(page.locator('.react-flow__edge')).toHaveCount(0);
        await expect(page.locator('.patch-module')).toHaveCount(2);
        await page.getByLabel('Wrapper module', { exact: true }).focus();
        await page.getByLabel('Wrapper module', { exact: true }).press('Enter');
        await page
            .getByText('Connect sockets without dragging', { exact: true })
            .click();
        await page
            .getByRole('combobox', { name: /^Source module/ })
            .selectOption('clause');
        await page
            .getByRole('combobox', { name: /^Output/ })
            .selectOption('module');
        await page
            .getByRole('combobox', { name: /^Destination module/ })
            .selectOption('trampoline');
        await page
            .getByRole('combobox', { name: /^Input/ })
            .selectOption('input:/v');
        await page
            .getByRole('button', { name: 'Connect', exact: true })
            .click();
        await expect(page.locator('.react-flow__edge')).toHaveCount(1);
        await page
            .getByText('Connect sockets without dragging', { exact: true })
            .click();
        await page
            .getByRole('button', { name: 'Build selected', exact: true })
            .click();
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toBeVisible({ timeout: 30_000 });
        await page.getByRole('button', { name: 'Review output' }).click();
        await expect(page.getByRole('dialog')).toContainText('pk(');
        await page.keyboard.press('Escape');
        await page.screenshot({
            path: 'test-results/studio-patch.png',
            fullPage: true,
        });

        await application.evaluate(({ dialog }, filename) => {
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: filename,
            });
        }, patchFile);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect
            .poll(async () => {
                try {
                    return JSON.parse(await readFile(patchFile, 'utf8')).nodes
                        .length;
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                        return 0;
                    throw error;
                }
            })
            .toBe(2);
        const saved = JSON.parse(await readFile(patchFile, 'utf8'));
        expect(saved.connections).toHaveLength(1);
        expect(saved.connections[0].kind).toBe('module');
        expect(saved.context.network).toBe('Regtest');

        await page.getByRole('tab', { name: 'Inspect', exact: true }).click();
        await page.getByRole('tab', { name: 'Patch', exact: true }).click();
        await expect(page.locator('.patch-module')).toHaveCount(2);
        await page.getByLabel('Arguments JSON', { exact: true }).fill('{');
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: 'Build selected', exact: true }),
        ).toBeDisabled();
        expect(errors).toEqual([]);

        // Reopening must resolve the saved hashes from the persistent cache,
        // even though the fresh renderer initially has only module summaries.
        await application.close();
        application = await launchDesktop(directory, process.env.SAPIO_CLI!);
        page = await application.firstWindow();
        page.on('pageerror', (error) => errors.push(error.message));
        await expect(
            page.getByRole('button', { name: /Open example patch/ }),
        ).toBeEnabled({ timeout: 30_000 });
        await application.evaluate(({ dialog }, filename) => {
            dialog.showOpenDialog = async () => ({
                canceled: false,
                filePaths: [filename],
            });
        }, patchFile);
        await page
            .getByRole('button', { name: 'Open patch', exact: true })
            .click();
        await expect(page.locator('.patch-module')).toHaveCount(2, {
            timeout: 120_000,
        });
        await expect(page.locator('.patch-workspace')).not.toContainText(
            'Missing module',
        );
        await page
            .locator('.patch-module')
            .filter({ hasText: 'Wrapper' })
            .click();
        await page
            .getByRole('button', { name: 'Build selected', exact: true })
            .click();
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toBeVisible({ timeout: 30_000 });
        expect(errors).toEqual([]);
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});
