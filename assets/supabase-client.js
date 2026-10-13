import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

export const hasSupabaseConfig = !SUPABASE_URL.includes('YOUR_PROJECT_ID')
  && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');

export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;