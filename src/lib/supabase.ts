import { createClient } from '@supabase/supabase-js';

import { authStorage } from '@/lib/auth-storage';
import { env, isSupabaseConfigured } from '@/lib/env';

export const supabase = isSupabaseConfigured
  ? createClient(env.supabaseUrl!, env.supabasePublishableKey!, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
