// Different runtime content sources must not share a writable ISR cache in integration tests.
import { cpSync, constants, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'wonderland-standalone-'));
const options = { recursive: true, mode: constants.COPYFILE_FICLONE, verbatimSymlinks: true };
cpSync('.next/standalone', root, options);
const app = join(root, 'src', 'w0nder-land');
rmSync(join(app, '.next', 'static'), { recursive: true, force: true });
rmSync(join(app, 'public'), { recursive: true, force: true });
cpSync('.next/static', join(app, '.next', 'static'), options);
cpSync('public', join(app, 'public'), options);
const child = spawn(process.execPath, [join(app, 'server.js')], {
  env: { ...process.env, HOSTNAME: '127.0.0.1', NODE_ENV: 'production' },
  stdio: 'inherit',
});
const stop = () => child.kill('SIGTERM');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', code => {
  rmSync(root, { recursive: true, force: true });
  process.exit(code ?? 0);
});
