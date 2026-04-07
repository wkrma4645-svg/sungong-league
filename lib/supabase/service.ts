import { createClient } from '@supabase/supabase-js';

// Service role client for API routes — no cookies needed
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
