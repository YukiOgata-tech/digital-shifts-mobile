function optionalValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export const env = {
  appName: optionalValue(process.env.EXPO_PUBLIC_APP_NAME) ?? 'Dミセ',
  webAppUrl: optionalValue(process.env.EXPO_PUBLIC_WEB_APP_URL),
  supabaseUrl: optionalValue(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: optionalValue(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  easProjectId: optionalValue(process.env.EXPO_PUBLIC_EAS_PROJECT_ID),
  pushNotificationsEnabled:
    optionalValue(process.env.EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED) === 'true',
} as const;

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);
