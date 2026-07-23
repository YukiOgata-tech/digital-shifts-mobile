import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';

export default function IndexRoute() {
  const { session } = useSession();
  return <Redirect href={session ? '/(staff)/(home)' : '/(auth)/sign-in'} />;
}
