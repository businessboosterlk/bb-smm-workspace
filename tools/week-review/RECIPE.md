# RECIPE: the Friday SMM week in review

Written 10 Nov 2026 after three silent failures (see Finishing touches). Rebuild from this file, never from memory.

## What it is

Every Friday at 17:00 Colombo time the Mac writes one page for each SMM who typed tasks in the Weekly Plan that week: the
numbers are counted in code from `smm_weekly_plan`, the words are drafted by DeepSeek on DeepInfra from those rows only, the
words are gated (house style, no numbers, no he or she, no blaming word) and the page is kept as a PDF in
`~/Downloads/BB-SMM-Week-Reviews`. A real run also writes the review to `smm_week_review` and, when there is no `HOLD` file
in this folder, releases it: the SMM sees it in the app and one push goes to the SMM and Shiara.

An SMM with no typed tasks gets no review. The three locked team slots and lunch are never tasks.

## Where the source lives

- `~/bb-smm-workspace/tools/week-review/lib.mjs`: the mould (network rail, gather, draft, gate, page, PDF, the two writes)
- `~/bb-smm-workspace/tools/week-review/friday.mjs`: the Friday job and the failing note
- `~/bb-smm-workspace/tools/week-review/build.mjs`: one sample PDF by hand, writes nothing to the database
- The schedule: `~/Library/LaunchAgents/lk.businessbooster.smm-week-review.plist` (label `lk.businessbooster.smm-week-review`)
- The log: `~/Library/Logs/bb-smm-week-review.log`, and one line per run in `~/bb-brain/usage/task-ledger.jsonl`
- Keys read at run time: the public key inside `~/bb-smm-workspace/index.html`, `~/.bb-secrets/deepinfra.key`,
  `~/.bb-secrets/booster-brain.env` (BRAIN_PUT_TOKEN)
- Database, project `yyviiwnqgphyklcoijyd`: reads `smm_weekly_plan` (keyed on `week_start` and `created_by`), `shared_ideas`,
  `clients`; writes through `bb_week_review_put` and `bb_week_review_release` only
- Playwright comes from `~/bb-systems/batch/node_modules/playwright`

## Rebuild from nothing

The tool has no build step. It needs Node 22 at `~/.local/node/bin/node` and the files above.

```bash
cd ~/bb-smm-workspace
~/.local/node/bin/node --check tools/week-review/lib.mjs
~/.local/node/bin/node --check tools/week-review/friday.mjs
~/.local/node/bin/node tools/week-review/friday.mjs --dry --week 2026-11-02
```

A dry run drafts and makes the PDFs and writes nothing to the database. It costs a fraction of a US cent.

## Gates

```bash
cd ~/bb-smm-workspace
# 1. a clean dry run: every SMM with typed tasks ends "drafted", exit code 0, one page each
WR_DEBUG=1 ~/.local/node/bin/node tools/week-review/friday.mjs --dry --week 2026-11-02
# 2. the heaviest week on record (Tiana, 43 tasks) must still fit one page
WR_DEBUG=1 ~/.local/node/bin/node tools/week-review/friday.mjs --dry --week 2026-10-26
# 3. a dead network must shout: names ENOTFOUND, exit code 1, leaves WEEK-REVIEW-FAILING.dry.txt
WR_WAITS=500,1000 WR_FAKE_HOST=no-such-host.invalid ~/.local/node/bin/node tools/week-review/friday.mjs --dry --week 2026-11-02
# 4. run gate 1 again: the dry note must be gone
```

Then open the PDFs in `~/Downloads/BB-SMM-Week-Reviews` and read them. Seen passing on 10 Nov 2026: weeks of 26 Oct, 2 Nov and 9 Nov.

## Deliver or deploy

Nothing to deploy. launchd starts `friday.mjs` fresh every Friday, so a saved file is live at the next run. Never start the
launchd job by hand and never run without `--dry` to test: a real run writes and, with no `HOLD` file, releases with a push.

```bash
# to hold releases (reviews are written, nobody is notified) until Thulaib says go
touch ~/bb-smm-workspace/tools/week-review/HOLD
# to write and release one week on Thulaib's word only
~/.local/node/bin/node ~/bb-smm-workspace/tools/week-review/friday.mjs --week 2026-11-02
```

## Finishing touches

- The connect window is raised to 1500 ms at the top of the mould | why: Node gives each address 250 ms and Colombo to a US host is about 290 ms, so every call died with a bare "fetch failed" on 23 Oct, 30 Oct and 6 Nov | held by: lib.mjs#setDefaultAutoSelectFamilyAttemptTimeout
- Every network call has a time limit and four tries (waits 3, 15 and 60 seconds) and a failure names its cause code | why: "fetch failed" told nobody anything for three weeks | held by: lib.mjs#causeOf
- Any failure leaves WEEK-REVIEW-FAILING.txt in this folder, raises a Mac notification and exits 1; the next clean run removes it; a dry run uses its own note | why: three Fridays failed in silence | held by: friday.mjs#WEEK-REVIEW-FAILING.txt
- Past 14 rows the week table is set in two columns, then the page shrinks a step at a time (floor 76 per cent) | why: Nirvana's 21 task week ran to 2 pages and was refused | held by: lib.mjs#TWO_COL
- The one page refusal stays as the guard | why: Thulaib, 23 Oct: one page per SMM | held by: lib.mjs#REFUSED
- "Carried" is emptied in code when every task is finished | why: on 10 Nov the model listed finished work as carried | held by: lib.mjs#Carried is a fact
- Both writes are safe to repeat: put replaces the row and never a released one, release only takes rows not yet released | why: lets the retry cover the writes with no second push | held by: lib.mjs#bb_week_review_release
- Tone: written to the person as "you", kind first, nothing is "missed" | why: Thulaib, 23 Oct: "I don't want it to feel like a prison" | held by: lib.mjs#prison
- The review reads ONLY tasks typed in the Weekly Plan under the SMM's own name | why: Tiana (since 2 Nov) and Hithesh (always) hold only the locked slots there, so they get no review; whether the review should read something else for the Creative and Publisher roles is Thulaib's call, asked in bb_pending | held by: lib.mjs#created_by

## Cast a copy

For another team (video, graphics): copy the three files, change `SEATS`, the table read in `gather` and the two database
functions. Keep the network rail, the one page guard and the failing note exactly as they are.

## Not on disk

- The launchd job is loaded on this Mac only; a new Mac needs `launchctl load` on the plist.
- The two database functions and the table `smm_week_review` live in Supabase, not in this repository.
- The Mac must be awake or wake after 17:00 on Friday; launchd runs a slept job on wake.
- Missed weeks are not back filled: 26 Oct (Nirvana, Tiana) and 2 Nov (Nirvana) wait on Thulaib's word.
