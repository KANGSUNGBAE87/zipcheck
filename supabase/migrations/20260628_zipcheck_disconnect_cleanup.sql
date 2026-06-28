grant delete on public.zipcheck_events to authenticated;

drop policy if exists "zipcheck events delete own" on public.zipcheck_events;
create policy "zipcheck events delete own"
  on public.zipcheck_events for delete to authenticated
  using (owner_auth_user_id = auth.uid());
