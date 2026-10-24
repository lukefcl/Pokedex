import type { NextConfig } from 'next';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const config: NextConfig = {
  poweredByHeader: false,
  compiler: {
    async runAfterProductionCompile({ projectDir, distDir }) {
      // Generate public assets before hosting adapters collect or relocate build output.
      execFileSync(process.execPath, [join(projectDir, 'scripts/build-offline.mjs'), projectDir, distDir], {
        cwd: projectDir,
        stdio: 'inherit',
      });
    },
  },
  async headers() {
    return [{ source: '/sw.js', headers: [
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Service-Worker-Allowed', value: '/' },
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
    ] }];
  },
};
export default config;
