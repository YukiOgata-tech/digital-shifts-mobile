import { useColorScheme } from 'react-native';

export const appThemes = {
  light: {
    background: '#F5F7F5',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF2EF',
    text: '#17211B',
    textSecondary: '#647069',
    border: '#DDE5DF',
    brand: '#079663',
    brandStrong: '#05764F',
    brandSoft: '#E4F6EE',
    warning: '#C96C12',
    warningSoft: '#FFF2E2',
    danger: '#C43D43',
    dangerSoft: '#FCEBED',
    info: '#2878B8',
    infoSoft: '#E8F3FB',
    tabBackground: '#FAFCFA',
  },
  dark: {
    background: '#101512',
    surface: '#18201B',
    surfaceMuted: '#202A24',
    text: '#F3F7F4',
    textSecondary: '#ABB8B0',
    border: '#314037',
    brand: '#35C58B',
    brandStrong: '#64DBA9',
    brandSoft: '#173A2C',
    warning: '#F2A54F',
    warningSoft: '#3A2917',
    danger: '#F07C82',
    dangerSoft: '#3A2023',
    info: '#72B7EA',
    infoSoft: '#193247',
    tabBackground: '#151B17',
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
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export function useAppTheme() {
  const scheme = useColorScheme();
  return appThemes[scheme === 'dark' ? 'dark' : 'light'];
}

export type AppTheme = ReturnType<typeof useAppTheme>;
