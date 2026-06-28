import { AvatarProfileConfig } from '../types';

export type AvatarOption = {
  id: string;
  label: string;
  description: string;
  url: string;
  accentColor: string;
};

export const avatarOptions: AvatarOption[] = [
  {
    id: 'user-avatar',
    label: 'My ActiveSense Avatar',
    description: 'Your saved workout avatar',
    url: '/avatars/avatar_test.glb',
    accentColor: '#14B8A6',
  },
];

export const defaultAvatarConfig: AvatarProfileConfig = {
  optionId: avatarOptions[0].id,
  label: avatarOptions[0].label,
  avatarUrl: avatarOptions[0].url,
  accentColor: avatarOptions[0].accentColor,
};

export const getAvatarOptionById = (optionId?: string) =>
  avatarOptions.find((option) => option.id === optionId) ?? avatarOptions[0];

const isTestAvatarUrl = (avatarUrl?: string) =>
  Boolean(avatarUrl?.includes('/avatars/test2.glb') || avatarUrl?.includes('/avatars/test3.glb'));

// Older local profiles may point at testing avatars, while platform-created avatars should be preserved.
export const normalizeAvatarConfig = (avatar?: Partial<AvatarProfileConfig> | null): AvatarProfileConfig => {
  const option = getAvatarOptionById(avatar?.optionId);
  const avatarUrl = isTestAvatarUrl(avatar?.avatarUrl) ? option.url : avatar?.avatarUrl || option.url;
  return {
    optionId: avatar?.optionId || option.id,
    label: avatar?.label || option.label,
    avatarUrl,
    accentColor: avatar?.accentColor || option.accentColor,
    sourceAvatarUrl: avatar?.sourceAvatarUrl,
    localAvatarUri: avatar?.localAvatarUri,
    cachedAt: avatar?.cachedAt,
    skinColor: avatar?.skinColor,
    head: avatar?.head,
    hair: avatar?.hair,
    faceMarks: avatar?.faceMarks,
    emote: avatar?.emote,
  };
};
