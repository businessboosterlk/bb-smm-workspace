# SMM WORKSPACE: PHONE ALERTS

What this system tells people, who it tells, plus what it deliberately says
nothing about. Written 7 September 2026.

## THE RULE THIS SYSTEM OBEYS

A person is told when something needs THEM. Nobody is told about their own
action. The client's OWN SMM, never both: one SMM runs a client. Alerts
about somebody else's clients are how a channel gets ignored.

## WHAT IS LIVE, all of it from 9 September 2026

The rule: one push when it needs HER, never about her own action, never the
other seat's clients. Silent when there is nothing.

| When | What | Who | Function |
|---|---|---|---|
| on assignment | A task is assigned to her | the assignee | `bb_notify_on_task`, debounced |
| on stage move | Her client's video or graphic reaches the client, comes back changed or is ready to post | the client's SMM | `bb_notify_rules` |
| 08:30 | Good morning | everyone | `bb_team_message` |
| **09:00** | **Her morning: overdue tasks, work sitting with her clients past a week, on Monday the week ahead and what carried over, in the last week of the month the delivery board** | the seat alone | `bb_smm_morning_brief` |
| 11:01, 15:31, 19:31 | Her meal is short | the seat, Thulaib, Shiara | `bb_meals_check` |
| 14:30 | Nothing ticked on her pillars yet | the seat alone | `bb_smm_pillars_untouched` |
| **Friday 16:00** | **Her clients with nothing in next week's plan** | the seat alone | `bb_smm_next_week_gap` |
| 17:00 | A shoot tomorrow, on Friday the next three days | the client's SMM and the video head | `bb_smm_shoot_tomorrow` |
| 17:30 | Recheck your pillars | everyone | `bb_team_message` |
| 19:45 | Day done | everyone | `bb_team_message` |

A normal good day is four pushes, three of them the messages Thulaib wrote. Every
function takes a dry switch that performs the real insert inside a subtransaction
and rolls it back, plus a date override so it can be rehearsed off its firing
day. A partial unique index makes a double send structurally impossible.

The screen shows what the push says: Today carries a "With Clients" panel and a
"Posts Today" panel read from the weekly plan. The Weekly Plan opens with
"Last week is not finished" when it is.

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
- The delivery board can lag a month. The morning brief asks whether the board
  EXISTS before it computes a percentage against nothing.
