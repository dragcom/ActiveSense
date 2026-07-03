const { getDefaultConfig } = require('expo/metro-config');

// Start from Expo's default Metro bundler settings.
const config = getDefaultConfig(__dirname);

// GLB files need to be treated as assets so native can bundle the avatar model.
if (!config.resolver.assetExts.includes('glb')) {
  config.resolver.assetExts.push('glb');
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'ios' && moduleName === 'three') {
    return context.resolveRequest(context, 'three-ios', platform);
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

// Export the final Metro config used by Expo start and native builds.
module.exports = config;
