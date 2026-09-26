'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'freeport-async', 'index.js');

if (!fs.existsSync(filePath)) {
  process.exit(0);
}

const original = fs.readFileSync(filePath, 'utf8');

if (
  original.includes('if (port < 0 || port > 65535)') &&
  original.includes('No available port found in the valid TCP port range') &&
  original.includes('try {\n      server.listen')
) {
  process.exit(0);
}

let patched = original;

const safeTestPortAsync = `function testPortAsync(port, hostname) {
  if (port < 0 || port > 65535) {
    return Promise.resolve(false);
  }

  return new Promise(function(fulfill) {
    var settled = false;
    var server = net.createServer();

    function done(value) {
      if (settled) return;
      settled = true;
      if (!value) {
        setTimeout(() => fulfill(false), 0);
        return;
      }
      server.close(function() {
        setTimeout(() => fulfill(value), 0);
      });
    }

    server.once("error", function() {
      done(false);
    });

    try {
      server.listen({ port: port, host: hostname }, function() {
        done(true);
      });
    } catch (err) {
      done(false);
    }
  });
}
`;

patched = patched.replace(
  /function testPortAsync\(port, hostname\) \{[\s\S]*?\n\}\n\nasync function availableAsync/,
  `${safeTestPortAsync}\nasync function availableAsync`
);

if (patched === original) {
  process.exit(0);
}

if (!patched.includes('No available port found in the valid TCP port range')) {
  patched = patched.replace(
    '    var lowPort = rangeStart || DEFAULT_PORT_RANGE_START;\n',
    '    var lowPort = rangeStart || DEFAULT_PORT_RANGE_START;\n    if (lowPort < 0 || lowPort + rangeSize - 1 > 65535) {\n      reject(new RangeError(\"No available port found in the valid TCP port range\"));\n      return;\n    }\n'
  );
}

if (patched === original) {
  process.exit(0);
}

fs.writeFileSync(filePath, patched);
