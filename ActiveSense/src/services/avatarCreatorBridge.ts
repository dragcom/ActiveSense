import { AvatarProfileConfig } from '../types';

export type AvatarCreatorMode = 'home' | 'configurator' | 'live';

export type AvatarCreatorMessage =
  | { type: 'WEBVIEW_READY'; data?: unknown }
  | { type: 'WEB_READY'; data?: unknown }
  | { type: 'SAVED_AVATAR'; data: AvatarProfileConfig }
  | { type: 'CAPTURE_SCREENSHOT'; data: string };

const DEFAULT_AVATAR_CREATOR_URL = process.env.EXPO_PUBLIC_AVATAR_CREATOR_URL;

const modeQuery: Record<AvatarCreatorMode, string> = {
  home: '',
  configurator: '?view=configurator',
  live: '?mode=live',
};

const withCreatorQuery = (origin: string, mode: AvatarCreatorMode) => {
  const query = modeQuery[mode];
  const base = origin.replace(/\/$/, '');
  if (!query || base.includes('?')) {
    return base;
  }
  return `${base}${query}`;
};

export const getAvatarCreatorUri = (mode: AvatarCreatorMode) => {
  return withCreatorQuery(process.env.EXPO_PUBLIC_AVATAR_CREATOR_URL ?? DEFAULT_AVATAR_CREATOR_URL, mode);
};

export const parseCreatorMessage = (raw: unknown): AvatarCreatorMessage | null => {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      return parsed as AvatarCreatorMessage;
    }
  } catch {
    return null;
  }
  return null;
};
