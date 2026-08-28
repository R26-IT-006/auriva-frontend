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
