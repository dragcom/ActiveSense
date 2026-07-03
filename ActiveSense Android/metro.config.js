const { getDefaultConfig } = require('expo/metro-config');

// Start from Expo's default Metro bundler settings.
const config = getDefaultConfig(__dirname);

// GLB files need to be treated as assets so native can bundle the avatar model.
if (!config.resolver.assetExts.includes('glb')) {
  config.resolver.assetExts.push('glb');
}

// Export the final Metro config used by Expo start and native builds.
module.exports = config;
