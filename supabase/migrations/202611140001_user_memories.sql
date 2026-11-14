create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.user_memories enable row level security;

drop policy if exists "Users can read their own memories" on public.user_memories;
create policy "Users can read their own memories"
  on public.user_memories for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own memories" on public.user_memories;
create policy "Users can create their own memories"
  on public.user_memories for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own memories" on public.user_memories;
create policy "Users can delete their own memories"
  on public.user_memories for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.user_memories to authenticated;
