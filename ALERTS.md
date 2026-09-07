# SMM WORKSPACE: PHONE ALERTS

What this system tells people, who it tells, plus what it deliberately says
nothing about. Written 7 September 2026.

## THE RULE THIS SYSTEM OBEYS

A person is told when something needs THEM. Nobody is told about their own
action. The client's OWN SMM, never both: one SMM runs a client. Alerts
about somebody else's clients are how a channel gets ignored.

## WHAT IS LIVE

| What happens | Who is told | How |
|---|---|---|
| A task is assigned to you | the assignee | `bb_notify_on_task`, debounced, twenty at once become one |
| Your meal is short | the SMM, plus Thulaib and Shiara | `bb_meals_check`, cron 11:01, 15:31, 19:31 Colombo Mon to Fri |

## WHAT IS BUILT AND WAITING FOR A CRON JOB

Thulaib's go is needed for any new scheduled job, so these three exist as
functions, rehearsed, scheduled by nobody yet.

```sql
-- a shoot is tomorrow. The client's SMM plus the video head, found by MEANING
-- (is_head plus a video role), so a new head needs no code change. On a Friday
-- it looks to Monday, because nothing runs at the weekend.
select cron.schedule('bb-smm-shoot-tomorrow','30 11 * * 1-5', $$select public.bb_smm_shoot_tomorrow(false)$$);  -- 17:00 Colombo

-- the delivery board in the last week of the month. The owning SMM plus the
-- COO, found by role. Its FIRST question is whether a board exists at all.
select cron.schedule('bb-smm-delivery-short','0 4 * * 1-5', $$select public.bb_smm_delivery_short(false)$$);      -- 09:30 Colombo

-- pillars untouched by the afternoon. That SMM alone.
select cron.schedule('bb-smm-pillars','0 9 * * 1-5', $$select public.bb_smm_pillars_untouched(false)$$);          -- 14:30 Colombo
```

Every one of them takes a dry switch that performs the REAL insert inside a
subtransaction and rolls it back, plus a date override so it can be rehearsed
on a day that is not the day it fires. That is not decoration. The meals check
shipped with a dry run that skipped the insert. A missing NOT NULL column
killed all three of its runs the next day with nobody told.

## WHAT SAYS NOTHING, ON PURPOSE

- **Every pipeline stage.** This system has no stages. The stage rules belong to
  Video and Graphic and none of them apply here.
- **The delivery board on any normal day.** It is a monthly rhythm. Telling
  somebody their board is not finished on the 8th is noise.
- **The pillars, as a fraction.** The pillar list lives in the app, not in the
  database, so a denominator cannot be computed here. The alert counts ticks and
  says none are ticked. It will never print "3 of 7", because nobody could
  reproduce that number.
- **The other SMM's clients.** Decided by Thulaib on 5 September after first
  saying both SMMs.
- **The head, on a pillar miss.** A person who has not started their own
  checklist does not need an audience.
- **Anything carrying a money figure.** Refused in the function before it
  reaches the queue, then refused again at the sender.

## LANDMINES

- Per-SMM scoping in this app is a client-side filter, not security. Never build
  an alert that assumes the filter is a wall.
- `tasks` is shared by four systems and `bb_notify_on_task` has no department
  filter, so a task assigned from anywhere reaches the assignee. That is
  probably right, because a task assigned to you is yours whoever sent it. It is
  flagged and deliberately unchanged. It is Thulaib's call, not mine.
- `bb_delivery.client` is free text with no link to `clients`, so a renamed
  client silently drops out of a board count.
- Only "July 2026" exists on the delivery board, two months on. The alert above
  is written to shout about the missing board first for exactly that reason.
