'use strict';

const fs = require('fs');
const { execFileSync, spawn } = require('child_process');

const MIN_NODE_MAJOR = 20;
const MAX_NODE_MAJOR = 22;

function getNodeMajor(binary) {
  try {
    const version = execFileSync(binary, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return Number(version.match(/^v(\d+)/)?.[1]);
  } catch {
    return null;
  }
}

function isSupportedMajor(major) {
  return major >= MIN_NODE_MAJOR && major <= MAX_NODE_MAJOR;
}

function findSupportedNode() {
  const candidates = [process.env.AURIVA_NODE_BINARY];

  if (process.platform === 'darwin') {
    candidates.push(
      '/opt/homebrew/opt/node@22/bin/node',
      '/usr/local/opt/node@22/bin/node',
      '/opt/homebrew/opt/node@20/bin/node',
      '/usr/local/opt/node@20/bin/node'
    );
  }

  return candidates.find(
    (binary) => binary && fs.existsSync(binary) && isSupportedMajor(getNodeMajor(binary))
  );
}

function relaunchWithSupportedNode(scriptPath) {
  const currentMajor = getNodeMajor(process.execPath);
  if (isSupportedMajor(currentMajor)) return false;

  const supportedNode = findSupportedNode();
  if (!supportedNode) {
    console.error(
      `Auriva requires Node ${MIN_NODE_MAJOR}-${MAX_NODE_MAJOR} for Expo SDK 54. ` +
        'Install Node 22 LTS or set AURIVA_NODE_BINARY to a supported Node executable.'
    );
    process.exit(1);
  }

  console.log(
    `Using Node ${getNodeMajor(supportedNode)} LTS for Expo (current Node is ${currentMajor}).`
  );
  const child = spawn(supportedNode, [scriptPath, ...process.argv.slice(2)], {
    env: process.env,
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

  return true;
}

module.exports = { relaunchWithSupportedNode };
