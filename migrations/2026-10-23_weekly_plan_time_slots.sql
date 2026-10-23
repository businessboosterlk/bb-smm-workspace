-- WEEKLY PLAN BY THE HOUR (23 Oct 2026). Waits for Thulaib's yes. Additive and nullable:
-- every existing row keeps working and shows under "No time yet".
alter table public.smm_weekly_plan
  add column starts_at time, add column ends_at time, add column link text;
-- ROLLBACK (drops the times and links typed since; read them out first if any exist):
-- alter table public.smm_weekly_plan drop column starts_at, drop column ends_at, drop column link;
