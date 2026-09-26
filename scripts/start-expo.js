'use strict';

const { relaunchWithSupportedNode } = require('./supported-node');

if (relaunchWithSupportedNode(__filename)) {
  // The supported Node child owns the Expo process lifecycle.
} else {
const os = require('os');
const { execFileSync, spawn } = require('child_process');

function getDefaultInterface() {
  if (process.platform !== 'darwin') return null;

  try {
    const route = execFileSync('route', ['-n', 'get', 'default'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return route.match(/^\s*interface:\s*(\S+)/m)?.[1] || null;
  } catch {
    return null;
  }
}

function isUsableIpv4(entry) {
  return entry?.family === 'IPv4' && !entry.internal && entry.address !== '0.0.0.0';
}

function isPrivateIpv4(address) {
  const octets = String(address).split('.').map(Number);
  return (
    octets.length === 4 &&
    (octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168))
  );
}

function findLanAddress() {
  const interfaces = os.networkInterfaces();
  const defaultInterface = getDefaultInterface();
  const defaultAddress = interfaces[defaultInterface]?.find(isUsableIpv4)?.address;

  if (defaultAddress) return defaultAddress;

  const candidates = Object.values(interfaces).flat().filter(isUsableIpv4);
  return (
    candidates.find((entry) => isPrivateIpv4(entry.address))?.address ||
    candidates[0]?.address ||
    null
  );
}

function getPortArg(argv) {
  const index = argv.indexOf('--port');
  const value = index >= 0 ? argv[index + 1] : argv.find((arg) => arg.startsWith('--port='))?.split('=')[1];
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : null;
}

function listPidsOnPort(port) {
  try {
    const output = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.split('\n').map((line) => Number(line.trim())).filter(Boolean);
  } catch {
    return [];
  }
}

function describePid(pid) {
  try {
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

// A stale Expo/Metro process from a previous run keeps port 8081 and makes the next
// `npm start` sit on the interactive "port is busy" prompt instead of printing the QR code.
function freeStalePort(port) {
  const projectRoot = require('path').resolve(__dirname, '..');
  const stalePids = listPidsOnPort(port).filter((pid) => {
    if (pid === process.pid) return false;
    const command = describePid(pid);
    return command.includes(projectRoot) && /expo|metro/.test(command);
  });

  for (const pid of stalePids) {
    console.log(`Stopping stale Expo process ${pid} holding port ${port}.`);
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }

  if (!stalePids.length) return;

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && listPidsOnPort(port).some((pid) => stalePids.includes(pid))) {
    try {
      execFileSync('sleep', ['0.25'], { stdio: 'ignore' });
    } catch {
      break;
    }
  }

  for (const pid of listPidsOnPort(port).filter((pid) => stalePids.includes(pid))) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  }
}

const args = process.argv.slice(2);
const env = { ...process.env };
const isLanStart = args.includes('--lan');

if (isLanStart && !env.REACT_NATIVE_PACKAGER_HOSTNAME) {
  const lanAddress = findLanAddress();
  if (!lanAddress) {
    console.error(
      'Unable to find a LAN IPv4 address. Connect this computer and phone to the same network, or use npm run start:tunnel.'
    );
    process.exit(1);
  }

  env.REACT_NATIVE_PACKAGER_HOSTNAME = lanAddress;
  console.log(`Expo LAN address: ${lanAddress}`);
}

const port = getPortArg(args);
if (port) {
  freeStalePort(port);
}

const expoCli = require.resolve('expo/bin/cli');
const child = spawn(process.execPath, [expoCli, 'start', ...args], {
  env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
}
