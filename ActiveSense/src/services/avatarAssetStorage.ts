import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import bundledDefaultAvatar from '../../public/avatars/avatar_test.glb';
import { defaultAvatarConfig, normalizeAvatarConfig } from '../data/avatars';
import { AvatarProfileConfig } from '../types';
import { getAvatarCreatorUri } from './avatarCreatorBridge';

const AVATAR_DIR = 'avatars/';
const USER_AVATAR_FILE = 'active-sense-user-avatar.glb';

const isHttpUri = (uri?: string) => Boolean(uri && /^https?:\/\//i.test(uri));
const isLocalFileUri = (uri?: string) => Boolean(uri && /^file:\/\//i.test(uri));
const isDefaultAvatar = (uri?: string) => Boolean(uri?.includes('/avatars/avatar_test.glb'));

const getSourceAvatarUri = (avatar: AvatarProfileConfig) =>
  avatar.sourceAvatarUrl || avatar.avatarUrl || defaultAvatarConfig.avatarUrl;

export const getAvatarRenderUri = (avatar?: AvatarProfileConfig | null) => {
  const normalized = normalizeAvatarConfig(avatar);
  if (Platform.OS === 'web') {
    const sourceAvatarUrl = isLocalFileUri(normalized.sourceAvatarUrl)
      ? undefined
      : normalized.sourceAvatarUrl;
    if (isLocalFileUri(normalized.localAvatarUri) || isLocalFileUri(normalized.avatarUrl)) {
      return sourceAvatarUrl || defaultAvatarConfig.avatarUrl;
    }
    return normalized.localAvatarUri || sourceAvatarUrl || normalized.avatarUrl;
  }
  if (isDefaultAvatar(getSourceAvatarUri(normalized))) {
    return defaultAvatarConfig.avatarUrl;
  }
  return normalized.localAvatarUri || normalized.avatarUrl;
};

const resolveRelativeAvatarUrl = (uri: string) => {
  if (!uri.startsWith('/')) {
    return uri;
  }
  try {
    return new URL(uri, getAvatarCreatorUri('home')).toString();
  } catch {
    return uri;
  }
};

const cacheAvatarForWeb = async (avatar: AvatarProfileConfig) => {
  const sourceUri = resolveRelativeAvatarUrl(getSourceAvatarUri(avatar));
  if (typeof caches !== 'undefined' && (isHttpUri(sourceUri) || sourceUri.startsWith('/'))) {
    try {
      const cache = await caches.open('activesense-avatar-models');
      await cache.add(sourceUri);
    } catch {
      // Browser model caching is best-effort; keep the original URL renderable.
    }
  }
  return {
    ...avatar,
    sourceAvatarUrl: getSourceAvatarUri(avatar),
    cachedAt: new Date().toISOString(),
  };
};

const ensureAvatarDirectory = async () => {
  const FileSystem = await import('expo-file-system/legacy');
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('Document storage is unavailable.');
  }
  const avatarDir = `${baseDir}${AVATAR_DIR}`;
  const dirInfo = await FileSystem.getInfoAsync(avatarDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(avatarDir, { intermediates: true });
  }
  return { FileSystem, avatarDir };
};

const copyBundledDefaultAvatar = async (destination: string) => {
  const { FileSystem } = await ensureAvatarDirectory();
  const asset = Asset.fromModule(bundledDefaultAvatar);
  await asset.downloadAsync();
  const sourceUri = asset.localUri || asset.uri;
  if (!sourceUri) {
    throw new Error('Default avatar asset is unavailable.');
  }
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
};

export const cacheAvatarGlb = async (avatar: AvatarProfileConfig): Promise<AvatarProfileConfig> => {
  const normalized = normalizeAvatarConfig(avatar);
  const sourceAvatarUrl = getSourceAvatarUri(normalized);

  if (isDefaultAvatar(sourceAvatarUrl)) {
    return {
      ...normalized,
      sourceAvatarUrl,
      localAvatarUri: undefined,
      cachedAt: normalized.cachedAt ?? new Date().toISOString(),
    };
  }

  if (isLocalFileUri(normalized.localAvatarUri || normalized.avatarUrl)) {
    return {
      ...normalized,
      sourceAvatarUrl,
      localAvatarUri: normalized.localAvatarUri || normalized.avatarUrl,
      cachedAt: normalized.cachedAt ?? new Date().toISOString(),
    };
  }

  if (Platform.OS === 'web') {
    return cacheAvatarForWeb(normalized);
  }

  try {
    const { FileSystem, avatarDir } = await ensureAvatarDirectory();
    const destination = `${avatarDir}${USER_AVATAR_FILE}`;
    const existing = await FileSystem.getInfoAsync(destination);
    if (existing.exists) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
    }

    const resolvedSource = resolveRelativeAvatarUrl(sourceAvatarUrl);
    if (isHttpUri(resolvedSource)) {
      await FileSystem.downloadAsync(resolvedSource, destination);
    } else {
      await copyBundledDefaultAvatar(destination);
    }

    return {
      ...normalized,
      sourceAvatarUrl,
      localAvatarUri: destination,
      cachedAt: new Date().toISOString(),
    };
  } catch {
    return {
      ...normalized,
      sourceAvatarUrl,
    };
  }
};
