'use strict';

// Fails fast on image files Android's AAPT2 cannot compile, before a ~20 minute
// release build discovers the same thing at :app:mergeReleaseResources.
//
// Two real cases this repo has hit:
//   - truncated PNGs (signature + header, no image data, no IEND chunk)
//   - JPEG/WebP data saved under a .png name
// Both display as a blank in Expo Go, so they go unnoticed until a release build.
//
// Usage: node scripts/check-image-assets.js [dir=assets]

const fs = require('fs');
const path = require('path');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IEND = Buffer.from('IEND', 'ascii');

function detectFormat(buf) {
  if (buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'gif';
  return 'unknown';
}

const EXPECTED = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp', '.gif': 'gif' };

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const root = process.argv[2] || 'assets';
const problems = [];
let checked = 0;

for (const file of walk(root)) {
  const expected = EXPECTED[path.extname(file).toLowerCase()];
  if (!expected) continue;
  checked += 1;

  const buf = fs.readFileSync(file);
  const actual = detectFormat(buf);

  if (actual !== expected) {
    problems.push(`${file}: contains ${actual} data but is named ${path.extname(file)}`);
  } else if (actual === 'png' && buf.lastIndexOf(IEND) === -1) {
    problems.push(`${file}: truncated PNG (${buf.length} bytes, no IEND chunk)`);
  }
}

if (problems.length) {
  console.error(`${problems.length} image file(s) Android cannot compile:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Checked ${checked} image files: all valid.`);
