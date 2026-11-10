import { createClient } from 'npm:@supabase/supabase-js@2';
import { createAppleRevoker } from './apple-revocation.mjs';
import { createDeleteAccountHandler } from './handler.mjs';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const revokeApple = createAppleRevoker(
  Deno.env.get('APPLE_NATIVE_CLIENT_ID'),
  Deno.env.get('APPLE_NATIVE_CLIENT_SECRET')
);
Deno.serve(createDeleteAccountHandler(admin, revokeApple));
