import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client.
 *
 * Credentials are read from environment variables (Astro: PUBLIC_ prefix).
 * Copy .env.example to .env and fill in your project credentials.
 * While unconfigured, the app runs fully offline/local; sync is a no-op.
 */

const url: string | undefined = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const isConfigured =
  Boolean(url && anonKey) &&
  !url!.includes('your-project-ref') &&
  !anonKey!.includes('your-anon');

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export { isConfigured };