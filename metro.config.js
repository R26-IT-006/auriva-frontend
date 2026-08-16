const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro bundles video files referenced via require()
for (const ext of ['mp4', 'mov']) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

// Allow Metro to bundle 3D model files
for (const ext of ['glb', 'gltf', 'bin']) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

module.exports = config;
