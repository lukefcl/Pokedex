import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/online.test.ts'], environment: 'node' } });
