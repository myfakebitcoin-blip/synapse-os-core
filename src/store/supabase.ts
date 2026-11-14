// Keep the auth store's local import stable while centralizing optional configuration
// and safe no-Supabase behavior in the shared client module.
export { supabase } from '../lib/supabase';
