export const colors = {
  primary: { teal: '#14B8A6', tealLight: '#2DD4BF', tealDark: '#0D9488' },
  secondary: { cyan: '#06B6D4', cyanLight: '#22D3EE', cyanDark: '#0891B2' },
  text: { primary: '#111827', secondary: '#6B7280', tertiary: '#9CA3AF' },
  background: { base: '#F9FAFB', card: '#FFFFFF', muted: '#F3F4F6', dark: '#1F2937' },
  border: '#E5E7EB',
  gradient: {
    primary: ['#14B8A6', '#06B6D4'],
    success: ['#2DD4BF', '#22D3EE'],
    warning: ['#FB923C', '#F43F5E'],
    purple: ['#A78BFA', '#EC4899'],
    privacy: ['#60A5FA', '#38BDF8'],
  },
} as const;
