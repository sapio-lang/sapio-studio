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

test('a saved typed patch runs real nested WASM and clears edited results', async () => {
    test.skip(
        !process.env.SAPIO_CLI,
        'Set SAPIO_CLI for the real module workflow; the Sapio CI job supplies it.',
    );
    test.setTimeout(240_000);
    const directory = await mkdtemp(path.join(tmpdir(), 'studio-patch-'));
    const patchFile = path.join(directory, 'clause.patch.json');
    let application = await launchDesktop(directory, process.env.SAPIO_CLI!);
    const errors: string[] = [];
    try {
        let page = await application.firstWindow();
        page.on('pageerror', (error) => errors.push(error.message));
        const example = page.getByRole('button', {
            name: /Open example patch/,
        });
        await expect(example).toBeEnabled({ timeout: 30_000 });
        await example.click();
        await expect(page.locator('.patch-node-card')).toHaveCount(4, {
            timeout: 120_000,
        });
        await expect(page.locator('[data-node-kind="variable"]')).toHaveCount(
            2,
        );
        await expect(page.locator('.react-flow__edge')).toHaveCount(3);
        const reference = page.getByLabel('Callable module connection', {
            exact: true,
        });
        await reference.focus();
        await reference.press('Enter');
        await expect(reference).toHaveClass(/\bselected\b/);
        await reference.press('Delete');
        await expect(page.locator('.react-flow__edge')).toHaveCount(2);
        await page
            .getByRole('button', { name: 'Wrapper: configure V', exact: true })
            .click();
        const picker = page.getByRole('region', {
            name: 'Choose input source',
        });
        await expect(picker).toBeVisible();
        await picker
            .getByRole('button', { name: /^Authorization implementation/ })
            .click();
        await expect(page.locator('.react-flow__edge')).toHaveCount(3);
        await page
            .getByRole('button', { name: 'Build output', exact: true })
            .click();
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toBeVisible({ timeout: 30_000 });
        await page.getByRole('button', { name: 'Review output' }).click();
        await expect(page.getByRole('dialog')).toContainText('pk(');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: /^fit view$/i }).click();
        await expect
            .poll(async () => {
                const canvas = await page.locator('.patch-flow').boundingBox();
                const nodes = await page.locator('.patch-node-card').all();
                if (!canvas) return false;
                const bounds = await Promise.all(
                    nodes.map((node) => node.boundingBox()),
                );
                return bounds.every(
                    (box) =>
                        box !== null &&
                        box.x >= canvas.x - 1 &&
                        box.y >= canvas.y - 1 &&
                        box.x + box.width <= canvas.x + canvas.width + 1 &&
                        box.y + box.height <= canvas.y + canvas.height + 1,
                );
            })
            .toBe(true);
        await page.screenshot({
            path: 'test-results/studio-typed-patch.png',
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
            .toBe(4);
        const saved = JSON.parse(await readFile(patchFile, 'utf8'));
        expect(saved.version).toBe(2);
        expect(
            saved.connections.filter(
                (edge: { kind: string }) => edge.kind === 'module',
            ),
        ).toHaveLength(1);
        expect(
            saved.connections.filter(
                (edge: { kind: string }) => edge.kind === 'value',
            ),
        ).toHaveLength(2);
        expect(saved.output).toBe('policy');
        expect(saved.context.network).toBe('Regtest');

        // The standalone module dialog uses the same typed field editor.
        await page
            .locator('.module-info-button')
            .filter({ hasText: 'Get Clause' })
            .click();
        const authoring = page.getByRole('dialog', {
            name: 'Module authoring',
        });
        await expect(
            authoring.getByLabel('Alice', { exact: true }),
        ).toHaveValue('');
        await expect(authoring.getByLabel('Bob', { exact: true })).toHaveValue(
            '',
        );
        await authoring
            .getByRole('button', { name: 'Run module', exact: true })
            .click();
        await expect(authoring.getByRole('alert')).toContainText('required');
        await authoring
            .getByLabel('Alice', { exact: true })
            .fill(
                saved.nodes.find((node: { id: string }) => node.id === 'alice')
                    .value,
            );
        await authoring
            .getByLabel('Bob', { exact: true })
            .fill(
                saved.nodes.find((node: { id: string }) => node.id === 'bob')
                    .value,
            );
        await authoring
            .getByRole('button', { name: 'Run module', exact: true })
            .click();
        await expect
            .poll(
                async () => ({
                    errors: await authoring
                        .getByRole('alert')
                        .allTextContents(),
                    results: await authoring
                        .locator('.module-result')
                        .allTextContents(),
                }),
                { timeout: 30_000 },
            )
            .toMatchObject({
                errors: [],
                results: [expect.stringContaining('pk(')],
            });
        await page.keyboard.press('Escape');

        await page
            .getByLabel('Alice public key variable', { exact: true })
            .click();
        // Selection does not change the designated policy output.
        await expect(
            page.getByLabel('Patch output', { exact: true }),
        ).toHaveValue('policy');
        await page.getByLabel('Value', { exact: true }).fill('not a key');
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toHaveCount(0);
        await page
            .getByRole('button', { name: 'Build output', exact: true })
            .click();
        await expect(page.locator('.patch-status')).toContainText(
            /Invalid Alice public key/,
        );
        expect(errors).toEqual([]);

        // A new isolated renderer resolves the saved exact hashes from its cache.
        await application.close();
        application = await launchDesktop(directory, process.env.SAPIO_CLI!);
        page = await application.firstWindow();
        page.on('pageerror', (error) => errors.push(error.message));
        await application.evaluate(({ dialog }, filename) => {
            dialog.showOpenDialog = async () => ({
                canceled: false,
                filePaths: [filename],
            });
        }, patchFile);
        await page.getByRole('tab', { name: 'Patch', exact: true }).click();
        await page
            .getByRole('button', { name: 'Open patch', exact: true })
            .click();
        await expect(page.locator('.patch-node-card')).toHaveCount(4, {
            timeout: 120_000,
        });
        await expect(page.locator('.patch-workspace')).not.toContainText(
            'Missing module',
        );
        await page
            .getByRole('button', { name: 'Build output', exact: true })
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

test('typed Variables and reusable Parameters work without a Sapio executable', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'studio-values-'));
    const definitionFile = path.join(directory, 'delay.patch.json');
    const application = await launchDesktop(
        directory,
        path.join(directory, 'missing-sapio-cli'),
    );
    try {
        const page = await application.firstWindow();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.getByRole('tab', { name: 'Patch', exact: true }).click();
        await page
            .getByRole('button', { name: 'Add Variable', exact: true })
            .click();
        await page
            .getByLabel('Variable type', { exact: true })
            .selectOption({ label: 'Whole number' });
        await page
            .getByRole('button', { name: 'Create Variable', exact: true })
            .click();
        await page
            .getByLabel('Node name', { exact: true })
            .fill('Waiting period');
        await page.getByLabel('Value', { exact: true }).fill('144');
        await page
            .getByRole('button', { name: 'Build output', exact: true })
            .click();
        await expect(page.locator('.patch-status')).toContainText(
            '0 module calls completed',
        );
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toBeVisible();
        await page
            .getByLabel('Node name', { exact: true })
            .fill('Withdrawal delay');
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toBeVisible();
        await page
            .getByLabel('Node name', { exact: true })
            .fill('Waiting period');

        await page
            .getByRole('button', { name: 'Expose as parameter', exact: true })
            .click();
        await expect(
            page.getByLabel('Parameter name', { exact: true }),
        ).toHaveValue('Waiting period');
        await page.getByLabel('Output name', { exact: true }).fill('delay');
        await page
            .getByRole('button', { name: 'Use as output', exact: true })
            .click();
        await application.evaluate(({ dialog }, filename) => {
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: filename,
            });
        }, definitionFile);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect
            .poll(async () => {
                try {
                    return JSON.parse(await readFile(definitionFile, 'utf8'))
                        .output;
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                        return '';
                    throw error;
                }
            })
            .toBe('delay');
        const definition = JSON.parse(await readFile(definitionFile, 'utf8'));
        expect(definition.nodes[0].kind).toBe('parameter');
        expect(definition.nodes[0].default).toBe(144);
        await application.evaluate(({ dialog }, filename) => {
            dialog.showOpenDialog = async () => ({
                canceled: false,
                filePaths: [filename],
            });
        }, definitionFile);
        await page
            .getByRole('button', { name: 'Import reusable patch', exact: true })
            .click();
        await expect(page.locator('[data-node-kind="subpatch"]')).toHaveCount(
            1,
        );
        await page
            .getByLabel('Output name', { exact: true })
            .fill('reused delay');
        await page
            .getByLabel('Output value', { exact: true })
            .selectOption('/delay');
        await page
            .getByRole('button', { name: 'Use as output', exact: true })
            .click();
        await page
            .getByRole('button', { name: 'Build output', exact: true })
            .click();
        await page.getByRole('button', { name: 'Review output' }).click();
        await expect(page.getByRole('dialog')).toContainText('144');
        await page.keyboard.press('Escape');
        await page.getByLabel('Waiting period', { exact: true }).fill('288');
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toHaveCount(0);
        await page
            .getByRole('button', { name: 'Build output', exact: true })
            .click();
        await page.getByRole('button', { name: 'Review output' }).click();
        await expect(page.getByRole('dialog')).toContainText('288');
        await page.keyboard.press('Escape');
        await page.screenshot({
            path: 'test-results/studio-reusable-parameters.png',
            fullPage: true,
        });
        await page
            .getByLabel('Waiting period', { exact: true })
            .fill('9007199254740993');
        await expect(
            page.getByRole('button', { name: 'Build output', exact: true }),
        ).toBeDisabled();
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toHaveCount(0);
        await expect(page.locator('.patch-status')).toContainText(
            'invalid field',
        );
        expect(errors).toEqual([]);
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});
