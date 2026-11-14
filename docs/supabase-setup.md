# Supabase setup (Module 4 foundation)

The frontend contains optional Supabase email/password authentication, private user memories, and room presence.

1. In Cloudflare, set the Pages/Workers build variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or Supabase publishable key). These are public client configuration values; never expose a `service_role` key in a `VITE_*` variable.
2. Apply `supabase/migrations/202611140001_user_memories.sql` in the Supabase SQL editor or through the Supabase CLI. Row-level security restricts memory access to the owning authenticated user.
3. Enable the desired email sign-in/confirmation options in Supabase Auth.
4. The UI shows an account and memory panel. Room presence uses a Supabase Realtime Presence channel and is enabled after sign-in. Existing Yjs/WebRTC canvas synchronization remains available independently.

Without the Supabase variables, the app continues to work with the Cloudflare Worker and P2P rooms; the panel explains that Supabase is not configured.
