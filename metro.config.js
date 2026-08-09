const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro bundles video files referenced via require()
if (!config.resolver.assetExts.includes('mp4')) {
  config.resolver.assetExts.push('mp4');
}
if (!config.resolver.assetExts.includes('mov')) {
  config.resolver.assetExts.push('mov');
}
// Allow Metro to bundle 3D model files
config.resolver.assetExts = [...config.resolver.assetExts, 'glb', 'gltf', 'bin'];

const escapedRoot = __dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

config.resolver.blockList = [
  new RegExp(`${escapedRoot}/android/.*`),
  new RegExp(`${escapedRoot}/ios/.*`),
];

module.exports = config;
