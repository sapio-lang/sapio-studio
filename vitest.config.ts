import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: [
            'desktop/**/*.test.ts',
            'src/**/*.test.ts',
            'tests/**/*.test.ts',
        ],
    },
});
