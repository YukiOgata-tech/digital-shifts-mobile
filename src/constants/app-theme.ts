import { useColorScheme } from 'react-native';

export const appThemes = {
  light: {
    background: '#F7F3EA',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    text: '#0F172A',
    textSecondary: '#64748B',
    border: '#CBD5E1',
    borderSoft: '#E2E8F0',
    brand: '#059669',
    brandStrong: '#047857',
    brandSoft: '#D1FAE5',
    brandBright: '#34D399',
    warning: '#B45309',
    warningSoft: '#FEF3C7',
    danger: '#E11D48',
    dangerSoft: '#FFE4E6',
    info: '#0369A1',
    infoSoft: '#E0F2FE',
    hero: '#020617',
    heroRaised: '#172033',
    heroText: '#FFFFFF',
    heroMuted: '#A7B0C0',
    tabBackground: '#FFFFFF',
  },
  dark: {
    background: '#0F172A',
    surface: '#172033',
    surfaceMuted: '#1E293B',
    text: '#F8FAFC',
    textSecondary: '#A7B0C0',
    border: '#475569',
    borderSoft: '#334155',
    brand: '#34D399',
    brandStrong: '#6EE7B7',
    brandSoft: '#064E3B',
    brandBright: '#34D399',
    warning: '#FBBF24',
    warningSoft: '#422006',
    danger: '#FB7185',
    dangerSoft: '#4C0519',
    info: '#38BDF8',
    infoSoft: '#0C4A6E',
    hero: '#020617',
    heroRaised: '#172033',
    heroText: '#FFFFFF',
    heroMuted: '#A7B0C0',
    tabBackground: '#111827',
  },
} as const;

export const appSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const appRadii = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export function useAppTheme() {
  const scheme = useColorScheme();
  return appThemes[scheme === 'dark' ? 'dark' : 'light'];
}

export type AppTheme = ReturnType<typeof useAppTheme>;
