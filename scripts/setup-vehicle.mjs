import { spawnSync } from 'node:child_process';
import { root, systemPython, vehiclePython } from './vehicle-runtime.mjs';
let python;
try { python = systemPython(); } catch (error) { process.stderr.write(error.message + '\n'); process.exit(1); }
for (const [command, args] of [[python.command, [...python.args, '-m', 'venv', '.venv-vehicle']], [vehiclePython, ['-m', 'pip', 'install', '-r', 'server/vehicle/requirements.txt']]]) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root, windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}
