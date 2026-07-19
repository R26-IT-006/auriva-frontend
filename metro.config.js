const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const escapedRoot = __dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

config.resolver.blockList = [
  new RegExp(`${escapedRoot}/android/.*`),
  new RegExp(`${escapedRoot}/ios/.*`),
];

module.exports = config;
