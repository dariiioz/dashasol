import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const vehiclePython = fileURLToPath(new URL(process.platform === 'win32' ? '../.venv-vehicle/Scripts/python.exe' : '../.venv-vehicle/bin/python', import.meta.url));
export function systemPython() {
  const candidates = process.env.DOMORYX_PYTHON ? [{ command: process.env.DOMORYX_PYTHON, args: [] }] : process.platform === 'win32' ? [{ command: 'python', args: [] }, { command: 'py', args: ['-3'] }] : [{ command: 'python3', args: [] }, { command: 'python', args: [] }];
  for (const candidate of candidates) if (spawnSync(candidate.command, [...candidate.args, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)'], { stdio: 'ignore', windowsHide: true }).status === 0) return candidate;
  throw new Error('Python 3.10 ou ultérieur est requis. Définissez DOMORYX_PYTHON si nécessaire.');
}
export function vehicleInstalled() { return existsSync(vehiclePython); }
