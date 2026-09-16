import {
    test,
    expect,
    _electron as electron,
    type Locator,
    type Page,
} from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

async function fitPatch(page: Page) {
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
}

async function watchNodeVisibility(canvas: Locator) {
    await expect
        .poll(() =>
            canvas
                .locator('.react-flow__node')
                .evaluateAll(
                    (nodes) =>
                        nodes.length > 0 &&
                        nodes.every(
                            (node) =>
                                getComputedStyle(node).visibility === 'visible',
                        ),
                ),
        )
        .toBe(true);
    await canvas.evaluate((element) => {
        const ids = new Set(
            Array.from(element.querySelectorAll('.react-flow__node'), (node) =>
                node.getAttribute('data-id'),
            ),
        );
        const hidden = new Set<string>();
        const observer = new MutationObserver((records) => {
            for (const record of records) {
                const node = record.target as HTMLElement;
                const id = node.getAttribute('data-id');
                if (!node.matches('.react-flow__node') || !id || !ids.has(id))
                    continue;
                // oldValue also catches a hide/show pair in the same render.
                if (
                    node.style.visibility === 'hidden' ||
                    /visibility:\s*hidden/.test(record.oldValue ?? '')
                )
                    hidden.add(id);
            }
        });
        observer.observe(element, {
            subtree: true,
            attributes: true,
            attributeFilter: ['style'],
            attributeOldValue: true,
        });
        (
            element as HTMLElement & { stopVisibilityAudit: () => string[] }
        ).stopVisibilityAudit = () => {
            observer.disconnect();
            return [...hidden];
        };
    });
}

async function finishNodeVisibilityCheck(canvas: Locator) {
    expect(
        await canvas.evaluate((element) =>
            (
                element as HTMLElement & { stopVisibilityAudit: () => string[] }
            ).stopVisibilityAudit(),
        ),
    ).toEqual([]);
}

async function viewportTransform(canvas: Locator) {
    return canvas
        .locator('.react-flow__viewport')
        .evaluate((element) => (element as HTMLElement).style.transform);
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
        const canvas = page.getByLabel('Validated contract graph', {
            exact: true,
        });
        await watchNodeVisibility(canvas);
        await canvas.getByRole('button', { name: /^zoom out$/i }).click();
        const viewport = await viewportTransform(canvas);
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
        await expect.poll(() => viewportTransform(canvas)).toBe(viewport);
        await finishNodeVisibilityCheck(canvas);
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
        await expect(page.locator('.patch-node-card')).toHaveCount(5, {
            timeout: 120_000,
        });
        await expect(page.locator('[data-node-kind="variable"]')).toHaveCount(
            2,
        );
        await expect(page.locator('.patch-node-variable')).toContainText([
            /Public key/,
            /Public key/,
        ]);
        const implementation = page.locator('[data-reference-only="true"]');
        await expect(implementation).toHaveCount(1);
        await expect(implementation).toContainText(
            'The calling module supplies the inputs.',
        );
        await expect(page.locator('.react-flow__edge')).toHaveCount(4);
        const reference = page.getByLabel('Callable module connection', {
            exact: true,
        });
        await reference.focus();
        await reference.press('Enter');
        await expect(reference).toHaveClass(/\bselected\b/);
        await reference.press('Delete');
        await expect(page.locator('.react-flow__edge')).toHaveCount(3);
        await expect(implementation).toHaveCount(0);
        await page
            .getByRole('button', {
                name: 'Wrapper: configure Authorization implementation',
                exact: true,
            })
            .click();
        const picker = page.getByRole('region', {
            name: 'Choose input source',
        });
        await expect(picker).toBeVisible();
        await picker
            .getByRole('button', { name: /^Authorization implementation/ })
            .click();
        await expect(page.locator('.react-flow__edge')).toHaveCount(4);
        await expect(implementation).toHaveCount(1);
        await page
            .getByRole('button', { name: 'Build patch', exact: true })
            .click();
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toBeVisible({ timeout: 30_000 });
        await page.getByRole('button', { name: 'Review output' }).click();
        await expect(page.getByRole('dialog')).toContainText('pk(');
        await page.keyboard.press('Escape');
        await fitPatch(page);
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
            .toBe(5);
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
        ).toHaveLength(3);
        expect(saved).not.toHaveProperty('output');
        expect(saved).not.toHaveProperty('outputs');
        const terminal = saved.nodes.find(
            (node: { kind: string }) => node.kind === 'output',
        );
        expect(terminal.name).toBe('policy');
        expect(
            saved.connections.filter(
                (edge: { target: string }) => edge.target === terminal.id,
            ),
        ).toEqual([
            expect.objectContaining({ source: 'trampoline', targetPath: '' }),
        ]);
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
                { timeout: 60_000 },
            )
            .toMatchObject({
                errors: [],
                results: [expect.stringContaining('pk(')],
            });
        await page.keyboard.press('Escape');

        await page
            .getByLabel('Alice public key variable', { exact: true })
            .click();
        // Editing a provider leaves the visible Policy terminal connected.
        await expect(
            page.getByLabel('Policy output', { exact: true }),
        ).toBeVisible();
        await page.getByLabel('Value', { exact: true }).fill('not a key');
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toHaveCount(0);
        await page
            .getByRole('button', { name: 'Build patch', exact: true })
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
        await expect(page.locator('.patch-node-card')).toHaveCount(5, {
            timeout: 120_000,
        });
        await expect(page.locator('.patch-workspace')).not.toContainText(
            'Missing module',
        );
        await page
            .getByRole('button', { name: 'Build patch', exact: true })
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

test('typed Variables and wired reusable Outputs work without a Sapio executable', async () => {
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
        await expect(
            page.getByLabel('Result output', { exact: true }),
        ).toBeVisible();
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
            .getByRole('button', {
                name: 'Result: connect output',
                exact: true,
            })
            .click();
        await page
            .getByRole('region', { name: 'Choose input source' })
            .getByRole('button', { name: /^Waiting period/ })
            .click();
        await expect(page.locator('.react-flow__edge')).toHaveCount(1);
        await page
            .getByRole('button', { name: 'Build patch', exact: true })
            .click();
        await expect(page.locator('.patch-status')).toContainText(
            '0 module calls completed',
        );
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toBeVisible();

        const canvas = page.locator('.patch-flow');
        await watchNodeVisibility(canvas);
        await canvas.getByRole('button', { name: /^zoom out$/i }).click();
        const viewport = await viewportTransform(canvas);
        await page
            .getByLabel('Waiting period variable', { exact: true })
            .click();
        await page
            .getByLabel('Node name', { exact: true })
            .fill('Withdrawal delay');
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toBeVisible();
        await page
            .getByLabel('Node name', { exact: true })
            .fill('Waiting period');
        await page.getByRole('tab', { name: /^Inspect/ }).click();
        await page.getByRole('tab', { name: 'Patch', exact: true }).click();
        await expect(page.getByLabel('Value', { exact: true })).toHaveValue(
            '144',
        );
        await expect.poll(() => viewportTransform(canvas)).toBe(viewport);
        await finishNodeVisibilityCheck(canvas);

        await page
            .getByRole('button', { name: 'Expose as parameter', exact: true })
            .click();
        await expect(
            page.getByLabel('Parameter name', { exact: true }),
        ).toHaveValue('Waiting period');
        await page.getByLabel('Result output', { exact: true }).click();
        await page.getByLabel('Output name', { exact: true }).fill('delay');
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
                    return JSON.parse(
                        await readFile(definitionFile, 'utf8'),
                    ).nodes.find(
                        (node: { kind: string }) => node.kind === 'output',
                    )?.name;
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                        return '';
                    throw error;
                }
            })
            .toBe('delay');
        const definition = JSON.parse(await readFile(definitionFile, 'utf8'));
        const parameter = definition.nodes.find(
            (node: { kind: string }) => node.kind === 'parameter',
        );
        const terminal = definition.nodes.find(
            (node: { kind: string }) => node.kind === 'output',
        );
        expect(parameter.default).toBe(144);
        expect(definition).not.toHaveProperty('outputs');
        expect(definition.connections).toEqual([
            expect.objectContaining({
                source: parameter.id,
                target: terminal.id,
                targetPath: '',
            }),
        ]);
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
            .getByRole('button', { name: 'Add Output', exact: true })
            .click();
        await page
            .getByLabel('Output name', { exact: true })
            .fill('reused delay');
        await page
            .getByRole('button', {
                name: 'Reused delay: connect output',
                exact: true,
            })
            .click();
        await page
            .getByRole('region', { name: 'Choose input source' })
            .getByRole('button', { name: /^delay · Delay/ })
            .click();
        await page
            .getByRole('button', {
                name: 'Reused delay: build output',
                exact: true,
            })
            .click();
        await page.getByRole('button', { name: 'Review output' }).click();
        await expect(page.getByRole('dialog')).toContainText('144');
        await page.keyboard.press('Escape');
        await page.getByLabel('delay subpatch', { exact: true }).click();
        await page.getByLabel('Waiting period', { exact: true }).fill('288');
        await expect(
            page.getByRole('button', { name: 'Review output' }),
        ).toHaveCount(0);
        await page
            .getByRole('button', {
                name: 'Reused delay: build output',
                exact: true,
            })
            .click();
        await page.getByRole('button', { name: 'Review output' }).click();
        await expect(page.getByRole('dialog')).toContainText('288');
        await page.keyboard.press('Escape');
        await fitPatch(page);
        await page.screenshot({
            path: 'test-results/studio-reusable-parameters.png',
            fullPage: true,
        });
        await page.getByLabel('delay subpatch', { exact: true }).click();
        await page
            .getByLabel('Waiting period', { exact: true })
            .fill('9007199254740993');
        await expect(
            page.getByRole('button', { name: 'Build patch', exact: true }),
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

test('a bound child transaction opens Spend with its own contract and linked PSBT', async () => {
    test.skip(
        !process.env.SAPIO_CLI,
        'Set SAPIO_CLI for real binding and spending-path validation.',
    );
    test.setTimeout(120_000);
    const directory = await mkdtemp(path.join(tmpdir(), 'studio-bound-'));
    const config = path.join(directory, 'runtime.json');
    const exportedPsbt = path.join(directory, 'pending-release.psbt');
    await writeFile(
        config,
        JSON.stringify({
            main: null,
            testnet: null,
            signet: null,
            regtest: {
                active: true,
                api_node: {
                    url: 'http://127.0.0.1:1',
                    auth: { CookieFile: '/deliberately/missing/cookie' },
                },
                covenant: { mode: 'native_ctv_research' },
            },
        }),
    );
    const application = await launchDesktop(directory, process.env.SAPIO_CLI!);
    try {
        const page = await application.firstWindow();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.getByRole('button', { name: /Studio settings/ }).click();
        const settings = page.getByRole('dialog');
        await settings
            .getByText('Binding configuration', { exact: true })
            .click();
        await settings.getByLabel('Optional runtime config').fill(config);
        await settings
            .getByRole('button', { name: 'Save & check CLI', exact: true })
            .click();
        await expect(settings.locator('.success-message')).toContainText(
            'sapio',
        );
        await page.keyboard.press('Escape');
        await application.evaluate(({ dialog }, filename) => {
            dialog.showOpenDialog = async () => ({
                canceled: false,
                filePaths: [filename],
            });
        }, path.resolve('tests/ui/fixtures/fixed-vault.artifact.json'));
        await page
            .getByRole('button', { name: 'Open artifact', exact: true })
            .click();
        await expect(
            page.getByText('Unbound template graph', { exact: true }),
        ).toBeVisible();
        const proposals = page.getByRole('button', {
            name: 'Generate proposal',
            exact: true,
        });
        await expect(proposals).toHaveCount(2);
        for (const proposal of await proposals.all())
            await expect(proposal).toBeDisabled();
        await page
            .getByRole('button', { name: 'Bind graph', exact: true })
            .first()
            .click();
        const binding = page.getByRole('dialog', {
            name: 'Bind contract graph',
        });
        await expect(binding.getByLabel('Funding source')).toHaveValue('mock');
        await binding
            .getByRole('button', { name: 'Bind graph', exact: true })
            .click();
        await expect(binding).toHaveCount(0);
        await expect(
            page.getByText('Mock-bound preview', { exact: true }),
        ).toBeVisible();
        await page
            .locator('.transaction-choices button')
            .filter({ hasText: 'pending' })
            .click();
        await expect(
            page.getByRole('heading', {
                name: 'Transaction template',
                exact: true,
            }),
        ).toBeVisible();
        await page
            .locator('.allocation-list')
            .getByRole('button', { name: /pending/ })
            .click();
        await expect(
            page.getByRole('heading', {
                name: 'Receiving contract',
                exact: true,
            }),
        ).toBeVisible();
        await page
            .locator('.transaction-choices button')
            .filter({ hasText: 'release' })
            .click();
        await expect(page.locator('.allocation-list')).toContainText('99,000');
        await page.getByText('Input requirements', { exact: true }).click();
        await expect(
            page.locator('details').filter({ hasText: 'Input requirements' }),
        ).toContainText('"sequence": 144');
        await application.evaluate(({ dialog }, filename) => {
            dialog.showSaveDialog = async () => ({
                canceled: false,
                filePath: filename,
            });
        }, exportedPsbt);
        await page
            .getByRole('button', { name: 'Export PSBT', exact: true })
            .click();
        await expect
            .poll(async () => {
                try {
                    return (await readFile(exportedPsbt, 'utf8')).trim();
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                        return '';
                    throw error;
                }
            })
            .toMatch(/^cHNidP/);
        const psbt = (await readFile(exportedPsbt, 'utf8')).trim();
        await page
            .getByRole('button', { name: 'Review spend', exact: true })
            .click();
        await expect(
            page.getByRole('tab', { name: 'Spend', exact: true }),
        ).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('.spend-source')).toContainText(
            'Spending the selected child contract.',
        );
        await expect(page.locator('.spend-source')).toContainText(
            'Synthetic funding preview',
        );
        await expect(
            page.getByLabel('Funded PSBT', { exact: true }),
        ).toHaveValue(psbt);
        await expect(
            page.getByLabel('Input index', { exact: true }),
        ).toHaveValue('0');
        await expect(page.locator('.spend-paths')).toContainText(
            'Funding: requirements met',
        );
        const paths = page.getByRole('combobox', {
            name: 'Available spending path',
            exact: true,
        });
        const release = paths.getByRole('option', {
            name: /^Script path \d+ · Transaction compatible$/,
        });
        await paths.selectOption((await release.getAttribute('value'))!);
        await expect(paths).toHaveValue(/^script:/);
        await page
            .getByText('Selected spending policy', { exact: true })
            .click();
        await expect(page.locator('.spend-paths')).toContainText(
            'txtmpl(e51217c0923f078d1c85dc549e63afeac8b2581a8bd3a8873f873baaba200ab9)',
        );
        await expect(
            page.getByRole('button', { name: 'Prepare intent', exact: true }),
        ).toBeEnabled();
        await page.screenshot({
            path: 'test-results/studio-bound-child-spend.png',
            fullPage: true,
        });
        await page
            .getByRole('button', { name: 'Prepare intent', exact: true })
            .click();
        await expect(
            page.getByLabel('Spend intent JSON', { exact: true }),
        ).not.toHaveValue('');
        await page
            .getByRole('button', { name: 'Back to graph', exact: true })
            .click();
        await expect(
            page.getByRole('heading', {
                name: 'Transaction template',
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            page.getByText('Mock-bound preview', { exact: true }),
        ).toBeVisible();
        await page
            .getByRole('button', { name: 'Go to source contract', exact: true })
            .click();
        await page
            .getByRole('button', {
                name: 'Go to creating transaction',
                exact: true,
            })
            .click();
        await expect(page.locator('.allocation-list')).toContainText('pending');
        await page
            .getByRole('button', { name: 'Change funding', exact: true })
            .click();
        await page
            .getByRole('dialog', { name: 'Bind contract graph' })
            .getByRole('button', { name: 'Bind graph', exact: true })
            .click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.getByRole('tab', { name: 'Spend', exact: true }).click();
        await expect(page.locator('.spend-source')).toHaveCount(0);
        await expect(
            page.getByLabel('Funded PSBT', { exact: true }),
        ).toHaveValue('');
        await page
            .getByRole('button', { name: 'Resume intent', exact: true })
            .click();
        await expect(
            page.getByLabel('Spend intent JSON', { exact: true }),
        ).toHaveValue('');
        await expect(
            page.getByLabel('Current PSBT', { exact: true }),
        ).toHaveValue('');
        expect(errors).toEqual([]);
    } finally {
        await application.close();
        await rm(directory, { recursive: true, force: true });
    }
});
