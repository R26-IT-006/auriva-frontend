'use strict';

const { relaunchWithSupportedNode } = require('./supported-node');

if (relaunchWithSupportedNode(__filename)) {
  // The supported Node child owns the Android build process lifecycle.
} else {
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

function isJava17(javaHome) {
  if (!javaHome) return false;

  try {
    const release = fs.readFileSync(path.join(javaHome, 'release'), 'utf8');
    return /JAVA_VERSION="17(?:\.|\")/.test(release);
  } catch {
    return false;
  }
}

function findJava17() {
  const candidates = [process.env.JAVA_HOME];

  if (process.platform === 'darwin') {
    try {
      candidates.push(
        execFileSync('/usr/libexec/java_home', ['-v', '17'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim()
      );
    } catch {
      // Java 17 may only be installed in Gradle's toolchain cache.
    }
  }

  const gradleJdks = path.join(os.homedir(), '.gradle', 'jdks');
  try {
    for (const entry of fs.readdirSync(gradleJdks)) {
      const root = path.join(gradleJdks, entry);
      candidates.push(
        process.platform === 'darwin' ? path.join(root, 'Contents', 'Home') : root
      );

      try {
        for (const child of fs.readdirSync(root)) {
          const childRoot = path.join(root, child);
          candidates.push(
            process.platform === 'darwin'
              ? path.join(childRoot, 'Contents', 'Home')
              : childRoot
          );
        }
      } catch {
        // Ignore non-directory cache entries such as archives and lock files.
      }
    }
  } catch {
    // Gradle has not provisioned a JDK yet.
  }

  return candidates.find(isJava17);
}

const javaHome = findJava17();

if (!javaHome) {
  console.error(
    'Java 17 is required for the Android build. Install JDK 17 or set JAVA_HOME to a JDK 17 installation.'
  );
  process.exit(1);
}

const expoCli = require.resolve('expo/bin/cli');
const child = spawn(process.execPath, [expoCli, 'run:android', ...process.argv.slice(2)], {
  env: { ...process.env, JAVA_HOME: javaHome },
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
