import React from 'react';

// Non-iOS builds should never instantiate the Expo GL avatar renderer.
export default function IosGlbAvatarView(_props: Record<string, unknown>) {
  return null;
}
