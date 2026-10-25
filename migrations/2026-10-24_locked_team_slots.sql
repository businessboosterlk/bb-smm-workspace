-- LOCKED TEAM SLOTS (Thulaib, 24 Oct 2026). Three slots every SMM has on every working day, which they can tick and note but never
-- delete or move: morning team update 08:30 to 09:00, afternoon team update 14:30 to 14:45, evening close 17:00 to 17:30.
-- The times live in ONE table, smm_locked_slots; changing a time there changes it for everyone from the next seeded week.
-- Rows are smm_weekly_plan rows with task_type 'lock_morning', 'lock_afternoon' or 'lock_close', added only by bb_smm_week_seed.
create table if not exists public.smm_locked_slots (
  kind text primary key check (kind like 'lock\_%'),
  label text not null, starts_at time not null, ends_at time not null check (ends_at > starts_at), ord int not null
);
insert into public.smm_locked_slots (kind, label, starts_at, ends_at, ord) values
  ('lock_morning', 'Morning team update', '08:30', '09:00', 1),
  ('lock_afternoon', 'Afternoon team update', '14:30', '14:45', 2),
  ('lock_close', 'Evening close', '17:00', '17:30', 3)
on conflict (kind) do nothing;
alter table public.smm_locked_slots enable row level security;
drop policy if exists smm_locked_slots_read on public.smm_locked_slots;
create policy smm_locked_slots_read on public.smm_locked_slots for select to anon, authenticated using (true);
revoke all on public.smm_locked_slots from anon, authenticated;
grant select on public.smm_locked_slots to anon, authenticated;

create unique index if not exists smm_weekly_plan_one_lock_a_day
  on public.smm_weekly_plan (created_by, week_start, day_of_week, task_type) where task_type like 'lock\_%';

-- THE GUARD. A locked slot is never added by hand, never deleted, never moved; its tick, note and link stay the SMM's.
create or replace function public.bb_smm_locked_guard() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('bb.smm_seed', true), '') = 'on' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and new.task_type like 'lock\_%' then
    raise exception 'Team slots are added by the system.' using errcode = '42501';
  elsif tg_op = 'DELETE' and old.task_type like 'lock\_%' then
    raise exception 'A team slot cannot be deleted.' using errcode = '42501';
  elsif tg_op = 'UPDATE' and (old.task_type like 'lock\_%' or new.task_type like 'lock\_%') and (
        new.task_type is distinct from old.task_type or new.week_start is distinct from old.week_start or
        new.day_of_week is distinct from old.day_of_week or new.starts_at is distinct from old.starts_at or
        new.ends_at is distinct from old.ends_at or new.created_by is distinct from old.created_by) then
    raise exception 'A team slot cannot be moved.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists smm_weekly_plan_locked_guard on public.smm_weekly_plan;
create trigger smm_weekly_plan_locked_guard before insert or update or delete on public.smm_weekly_plan
  for each row execute function public.bb_smm_locked_guard();

-- THE SEED. Adds the missing team slots for one SMM for one week, Monday to Friday. Safe to call on every open: it only fills gaps.
-- Never seeds a week that has already ended.
create or replace function public.bb_smm_week_seed(p_seat text, p_week date) returns int
language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; v_this date := date_trunc('week', (now() at time zone 'Asia/Colombo'))::date;
begin
  if p_seat not in ('Nirvana', 'Tiana', 'Hithesh') then raise exception 'Not an SMM seat.' using errcode = '22023'; end if;
  if extract(isodow from p_week) <> 1 then raise exception 'A week starts on a Monday.' using errcode = '22023'; end if;
  if p_week < v_this or p_week > v_this + 28 then return 0; end if;
  perform set_config('bb.smm_seed', 'on', true);
  insert into smm_weekly_plan (week_start, day_of_week, client_name, task_type, task_count, notes, status, assigned_to, created_by, starts_at, ends_at)
  select p_week, d, null, s.kind, 1, null, 'planned', p_seat, p_seat, s.starts_at, s.ends_at
    from smm_locked_slots s cross join generate_series(1, 5) d
   where not exists (select 1 from smm_weekly_plan w where w.created_by = p_seat and w.week_start = p_week and w.day_of_week = d and w.task_type = s.kind);
  get diagnostics n = row_count;
  perform set_config('bb.smm_seed', 'off', true);
  return n;
end $$;
revoke all on function public.bb_smm_week_seed(text, date) from public, authenticated;
grant execute on function public.bb_smm_week_seed(text, date) to anon, service_role;

-- The Monday brief counts work, not the team slots.
-- (applied separately as an exact replace: v_plan and v_carry skip task_type like 'lock_%')

-- ROLLBACK:
-- drop trigger smm_weekly_plan_locked_guard on public.smm_weekly_plan; drop function public.bb_smm_locked_guard();
-- drop function public.bb_smm_week_seed(text, date); drop index public.smm_weekly_plan_one_lock_a_day;
-- delete from public.smm_weekly_plan where task_type like 'lock\_%'; drop table public.smm_locked_slots;
