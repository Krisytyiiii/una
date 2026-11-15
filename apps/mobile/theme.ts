// theme.ts: design tokens v2 ("sunrise") for the DOrSU student app (React Native)
// Fonts: Roboto, matching the web portal (apps/web loads Roboto 400/500/700).
// Loaded in app/_layout.tsx from @expo-google-fonts/roboto.

export const colors = {
  ink: '#14315C',
  blue: '#2563B8',
  blueDark: '#1E50A0',
  sky: '#DDEBFB',
  chip: '#EEF3FB',

  sun: '#FFC93C',
  sunSoft: '#FFEFB8',

  cream: '#FFF8E1',
  creamLine: '#F0E2AE',
  surface: '#FFFFFF',
  white: '#FFFFFF',

  muted: '#55657F',
  border: '#D9DFEA',
  disabledBg: '#F3F4F7',
  disabledText: '#6B7689',

  // Semantic status colours. Labels and fills must always agree: amber means
  // "waiting on someone", green means "done", red means "ended badly". Used by
  // StatusChip and the session journey/check-in surfaces.
  success: '#177A4C',
  successSoft: '#DFF3E8',
  warn: '#9A6400',
  warnSoft: '#FFF1D6',
  danger: '#D92D20',
  dangerSoft: '#FDE7E5',
} as const;

// Body sizes stay in the 10-16 range. `display` is the single large size and is
// reserved for first-run/marketing headlines (onboarding), never app chrome.
export const fontSize = { xxs: 10, xs: 11, sm: 12, md: 13, lg: 14, xl: 16, display: 30 } as const;

export const fontFamily = {
  regular: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  bold: 'Roboto_700Bold',
} as const;

export const radius = 4; // inputs, chips, tiles, tab items, accents
export const buttonRadius = 16; // buttons only
export const cardRadius = 16; // cards only
export const sheetRadius = 28; // floating bottom sheets
export const navHeight = 62; // floating tab bar height (excluding the bottom gap)
export const navRadius = 31; // floating tab bar pill

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const sizes = {
  buttonHeight: 32,
  inputHeight: 44,
  iconButton: 24,
  tabBarIcon: 26,
  tabIcon: 16,
  screenPadding: 16,
} as const;

// Use on every Pressable so 24px buttons stay easy to tap.
export const hitSlop = { top: 10, bottom: 10, left: 8, right: 8 } as const;

// Card look: flat white with a 1px cream line underneath.
export const cardShadow = {
  shadowColor: colors.ink,
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 1,
} as const;

// Floating chrome (tab bar, sheets) needs a deeper, softer lift than a card.
export const floatingShadow = {
  shadowColor: colors.ink,
  shadowOpacity: 0.16,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 12,
} as const;

export const sheetShadow = {
  shadowColor: colors.ink,
  shadowOpacity: 0.22,
  shadowRadius: 32,
  shadowOffset: { width: 0, height: -8 },
  elevation: 24,
} as const;

// Frosted-glass layers. `fill` sits under the native blur so Android (which
// falls back to a plain translucent view) still reads as glass.
export const glass = {
  fill: 'rgba(255,255,255,0.74)',
  fillStrong: 'rgba(255,255,255,0.9)',
  border: 'rgba(255,255,255,0.9)',
  sheen: 'rgba(255,255,255,0.55)',
  active: 'rgba(255,201,60,0.5)',
  overlay: 'rgba(16,34,64,0.45)',
} as const;

export const theme = {
  colors,
  fontSize,
  fontFamily,
  radius,
  spacing,
  sizes,
  hitSlop,
  cardShadow,
  floatingShadow,
  sheetShadow,
  glass,
};
export type Theme = typeof theme;
