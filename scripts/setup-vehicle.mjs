import { spawnSync } from 'node:child_process';
const python = process.env.DOMORYX_PYTHON || 'python3';
const version = spawnSync(python, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)'], { stdio: 'ignore' });
if (version.status !== 0) {
  process.stderr.write('Python 3.10 ou ultérieur est requis. Définissez DOMORYX_PYTHON avec le chemin de votre Python.\n');
  process.exit(1);
}
for (const [command, args] of [[python, ['-m', 'venv', '.venv-vehicle']], [process.platform === 'win32' ? '.venv-vehicle/Scripts/python.exe' : '.venv-vehicle/bin/python', ['-m', 'pip', 'install', '-r', 'server/vehicle/requirements.txt']]]) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
