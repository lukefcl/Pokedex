import { execFileSync } from 'node:child_process';
if (process.env.CONVEX_DEPLOY_KEY) {
  // Convex injects its matching public deployment URL into the Next.js build.
  execFileSync(
    process.execPath,
    [
      'node_modules/convex/bin/main.js',
      'deploy',
      '--cmd',
      'npm run build',
      '--cmd-url-env-var-name',
      'NEXT_PUBLIC_CONVEX_URL',
    ],
    { stdio: 'inherit' },
  );
} else {
  await import('./prepare-scanner-runtime.mjs');
  execFileSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
    stdio: 'inherit',
  });
}
