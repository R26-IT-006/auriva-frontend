const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro bundles video files referenced via require()
if (!config.resolver.assetExts.includes('mp4')) {
  config.resolver.assetExts.push('mp4');
}
if (!config.resolver.assetExts.includes('mov')) {
  config.resolver.assetExts.push('mov');
}

module.exports = config;
