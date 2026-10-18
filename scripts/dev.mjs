import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.platform === 'win32' ? '.venv-vehicle/Scripts/python.exe' : '.venv-vehicle/bin/python';
const children = [];
const start = (command, args) => {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  child.on('error', () => { process.stderr.write('Impossible de démarrer un service Domoryx.\n'); });
  children.push(child); return child;
};
if (existsSync(new URL('../' + python, import.meta.url))) start(python, ['server/vehicle/app.py']);
else process.stderr.write('Connexion Volkswagen : lancez npm run vehicle:setup pour installer le service local optionnel.\n');
start(process.execPath, ['server/eufy/server.mjs']);
const vite = start(process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)]);
const stop = () => { for (const child of children) child.kill('SIGTERM'); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
vite.on('exit', code => { stop(); process.exitCode = code ?? 0; });
