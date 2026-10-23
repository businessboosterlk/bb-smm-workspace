-- SMM WEEK IN REVIEW (23 Oct 2026, Thulaib: "go ahead", option B: the SMM and Shiara).
-- One row per SMM per week. Written ONLY by the Mac's Friday job through bb_week_review_put, which opens with the
-- Mac-only Brain put secret (bb_brain_put_token_ok). The app reads it with the public key like every other SMM table.
-- The SMM may add one line of her or his own (smm_note): the review is a conversation, not a verdict.
create table if not exists public.smm_week_review (
  id bigserial primary key,
  seat text not null check (seat in ('Nirvana','Tiana','Hithesh')),
  week_start date not null check (extract(isodow from week_start) = 1),
  numbers jsonb not null,
  words jsonb not null,
  model text,
  usd numeric(10,6),
  created_at timestamptz not null default now(),
  released_at timestamptz,
  smm_note text check (smm_note is null or length(smm_note) <= 600),
  smm_note_at timestamptz,
  unique (seat, week_start)
);
alter table public.smm_week_review enable row level security;
drop policy if exists smm_week_review_read on public.smm_week_review;
create policy smm_week_review_read on public.smm_week_review for select to anon, authenticated using (true);
drop policy if exists smm_week_review_note on public.smm_week_review;
create policy smm_week_review_note on public.smm_week_review for update to anon, authenticated using (released_at is not null) with check (released_at is not null);
revoke all on public.smm_week_review from anon, authenticated;
grant select on public.smm_week_review to anon, authenticated;
grant update (smm_note, smm_note_at) on public.smm_week_review to anon, authenticated;

create or replace function public.bb_week_review_put(p_seat text, p_week date, p_numbers jsonb, p_words jsonb, p_model text, p_usd numeric)
returns bigint language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_id bigint;
begin
  if not public.bb_brain_put_token_ok() then raise exception 'You do not have access to this item.' using errcode = '42501'; end if;
  insert into public.smm_week_review (seat, week_start, numbers, words, model, usd)
  values (p_seat, p_week, p_numbers, p_words, p_model, p_usd)
  on conflict (seat, week_start) do update set numbers = excluded.numbers, words = excluded.words, model = excluded.model, usd = excluded.usd, created_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- Release one week: the reviews become visible to their SMM and one push goes to that SMM and to Shiara. Once only.
create or replace function public.bb_week_review_release(p_week date, p_dry boolean default true)
returns table(seat text, queued boolean, note text) language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare r record; v_ids bigint[]; v_shiara bigint;
begin
  if not public.bb_brain_put_token_ok() then raise exception 'You do not have access to this item.' using errcode = '42501'; end if;
  select id into v_shiara from team_members where active and upper(name) = 'SHIARA' limit 1;
  for r in select w.* from smm_week_review w where w.week_start = p_week and w.released_at is null order by w.seat loop
    select array_remove(array_agg(m.id) || v_shiara, null) into v_ids from team_members m where m.active and upper(m.name) = upper(r.seat);
    seat := r.seat; queued := false;
    if p_dry then
      begin
        update smm_week_review set released_at = now() where id = r.id;
        insert into bb_notify_queue (source_table, source_id, to_stage, title, body, url, recipients, send_after)
        values ('smm_week_review', r.id, 'released', r.seat || ', your week in review is ready', 'Open the Weekly Plan to read it and add your own note.',
                'https://businessboosterlk.github.io/bb-smm-workspace/', v_ids, bb_notify_send_after(now()));
        raise exception 'BB_DRY_ROLLBACK';
      exception when others then
        note := case when sqlerrm = 'BB_DRY_ROLLBACK' then 'rehearsed and rolled back, recipients ' || array_to_string(v_ids, ',') else 'REFUSED: ' || sqlerrm end;
      end;
    else
      update smm_week_review set released_at = now() where id = r.id;
      begin
        insert into bb_notify_queue (source_table, source_id, to_stage, title, body, url, recipients, send_after)
        values ('smm_week_review', r.id, 'released', r.seat || ', your week in review is ready', 'Open the Weekly Plan to read it and add your own note.',
                'https://businessboosterlk.github.io/bb-smm-workspace/', v_ids, bb_notify_send_after(now()));
        queued := true; note := 'released, recipients ' || array_to_string(v_ids, ',');
      exception when unique_violation then note := 'released, push already queued';
      end;
    end if;
    return next;
  end loop;
end $$;
revoke all on function public.bb_week_review_put(text, date, jsonb, jsonb, text, numeric) from public, authenticated;
revoke all on function public.bb_week_review_release(date, boolean) from public, authenticated;
grant execute on function public.bb_week_review_put(text, date, jsonb, jsonb, text, numeric) to anon, service_role;
grant execute on function public.bb_week_review_release(date, boolean) to anon, service_role;

-- ROLLBACK:
-- drop function public.bb_week_review_release(date, boolean); drop function public.bb_week_review_put(text, date, jsonb, jsonb, text, numeric);
-- drop table public.smm_week_review;

-- 23 Oct, later: bb_week_review_put never rewrites a RELEASED review (the SMM may have answered it). Applied as smm_week_review_put_keeps_released.
