import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/ui',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: { trace: 'retain-on-failure' },
});
