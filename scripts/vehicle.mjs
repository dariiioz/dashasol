import { spawn } from 'node:child_process';
import { root, vehiclePython, vehicleInstalled } from './vehicle-runtime.mjs';
if (!vehicleInstalled()) { process.stderr.write('Service véhicule non installé. Lancez npm run vehicle:setup.\n'); process.exit(1); }
const args = process.argv[2] === 'test' ? ['-m', 'unittest', 'discover', '-s', 'server/vehicle', '-p', 'test_*.py'] : ['server/vehicle/app.py'];
const child = spawn(vehiclePython, args, { cwd: root, stdio: 'inherit', windowsHide: true });
child.on('error', error => { process.stderr.write(`Service véhicule : ${error.message}\n`); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill('SIGTERM')); process.on('SIGTERM', () => child.kill('SIGTERM'));
