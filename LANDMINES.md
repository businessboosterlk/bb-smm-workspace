# LANDMINES · BB SMM Workspace

The register of failure classes found in this system. Prefix `L-SMM-`.
**Never delete an entry.** A fixed landmine stays, because the entry is what
stops the class coming back, not the fix.

Created 2026-08-22, when the self-test harness went in. Entries 001 to 004 and
007 to 010 are backfilled from work done between 30 July and 22 August. 005 and
006 were found by the harness on its first run.

---

## OPEN

### L-SMM-003 · `bb_delivery.client` is free text with no link to `clients`
**Symptom.** A client can be on the Delivery board under a name that matches no
client record and nothing says so. It simply vanishes from any filter that
joins the two.
**Evidence, 2026-08-22 harness run:** 7 unmatched rows. `Excellent Mobile` vs
`EXCELLENT`, `Fusion Media` vs `FUSION`, `Ceylon Carriers` vs
`CEYLON CARRIER TRAVELS`, `Clove Waduwa` vs `CLOVE WADDUWA`, and three more.
**Why it survives.** The board renders from its own text column, so it looks
perfectly correct on screen. Only a join reveals it.
**The block.** Harness check `Delivery: every row points at a real client`. It
fails naming the unmatched names. It SKIPS with a stated reason when the
view is narrowed to one seat, rather than reporting false orphans.
**Not fixed.** Renaming touches live data the Command Centre also reads, so it
needs Thulaib's per-name approval.

### L-SMM-004 · `team_members` has no department filter at all
**Symptom.** SMM reads the whole company roster. 16 people readable, 14 of them
are not SMM: `SUHANA (Graphic Designer)`, `RAMANI (editor)`, `USHANE
(video_head)`, `RAJEEWA (editor)` and others.
**Prior art.** This is L-VID-021 in the Video System, fixed there 2026-08-21.
Video's Team page listed all 11 people at BB instead of its 5, because it asked
for "everyone" when it meant "my department".
**The block.** Harness check `Team: SMM shows only SMM people`, which names the
outsiders rather than counting them.
**When fixed, fix it by MEANING.** A role predicate like Video's `isVideoRole()`,
never a list of today's names. A name list is wrong the day someone joins.

### L-SMM-009 · `bbdTog` optimistic write race
**Symptom.** `bbdTog` flips a tick, re-renders, and `renderSmmDelivery()`
refetches and overwrites `BBD_ROWS` from the database, possibly before the PATCH
has landed. Two toggles about a second apart lost the second one during testing
and left live data changed.
**Harmless at human clicking speed.** Registered because it is a real ordering
fault and because any script that drives the board must not trust the end state.

### L-SMM-010 · `cal-filter-assignee` is a dead control
**Symptom.** The Calendar filter bar has an assignee dropdown. Changing it calls
`renderCalendar`, and `renderCalendar` never reads the value. Verified: zero
occurrences of `assign` inside that function. The filter does nothing at all.
**Pre-existing.** Not introduced by any recent work.

---

## FIXED. The entry stays anyway

### L-SMM-001 · `tasks.assign` vocabulary drift hides work from the Command Centre
**Symptom.** 44 tasks written 30 to 31 July were invisible in the Command Centre
while looking perfectly normal in SMM.
**Root cause.** `tasks` is shared. The Command Centre matches `assign` as an
EXACT string and its vocabulary is lowercase role codes (`th`, `sh`, `both`,
`smm`, `gd`, `video`) or a person's full name. SMM wrote two-letter initials
(`NV`, `TH`, `TI`), which match nothing there.
**Fixed 2026-07-31.** The dropdown writes CC values. `TASK_ASSIGN_LEGACY`
translates old codes on edit and on copy. Anything unrecognised, such as `KE`,
is preserved verbatim so a task is never silently reassigned.
**The wider rule.** Two apps, one column, two vocabularies with no shared
constant. When you must match a shared string column, match every spelling it
has ever held.

### L-SMM-002 · a personal surface widened when a shared variable changed meaning
**Symptom, twice.** The daily popup showed Tiana the list of Nirvana's clients.
Fixed 12 August. Reappeared 21 August.
**Root cause the first time.** The popup queried `content_plans` with no client
filter at all.
**Root cause the second time. This is the one worth reading.** The Everyone
/ Just mine filter shipped, and `S.clients` stopped meaning "your clients" and
started meaning "whatever the filter says". Every reader of it widened silently,
including the popup's `ciScopeIds()`. I had even written the safe alternative,
`S_myClientIds`, in the same commit. I then used it in two of the three places
that needed it.
**Fixed 2026-08-22.** The popup reads `S_myClientIds`, which never widens.
**The block.** Two harness checks: `Scope: the personal list NEVER widens`,
which flips the stored preference and measures both directions, and
`Scope: the daily popup reads the personal list, not the widening one`, which
scans the source so behaviour cannot drift back quietly.
**The wider rule.** Writing the safe alternative is not the same as retiring the
unsafe one. When you change what a shared name MEANS, list every reader and
decide each one.
**And:** a count check cannot catch a scope bug. "7 posts" is a reasonable
number. Assert the IDENTITY of what came back, not the size of it.

### L-SMM-005 · a shorthand reset the safe-area inset that came before it
**Symptom.** The mobile topbar's height grew correctly for a notch while its
content stayed jammed at the top, under the Dynamic Island.
**Root cause.** The rule read `padding-top: var(--sat)` and then, further down
the SAME rule, `padding: 0 14px`. A shorthand resets the longhand before it.
The box measured correctly, so nothing that measured height would ever catch it.
**Found by the harness on its first run, 2026-08-22**, four days after the phone
work shipped.
**Fixed.** The inset lives IN the shorthand: `padding: var(--sat) 14px 0`.
**The block.** Harness check `Shell: chrome moves down for a notch`, which pushes
`--sat` to 59px and asserts the padding actually moved.

### L-SMM-006 · a regex rewrote `border-bottom: 1px` as a safe-area inset
**Symptom.** The mobile topbar carried a bottom border of `calc(1px +
var(--sab))`. On a handset with a 34px home indicator that is a 35px border.
**It shipped.** Live from 21 to 22 August.
**Root cause.** A pass meant to lift fixed chrome clear of the home indicator
replaced `bottom:\\s*(\\d+)px` inside declaration blocks that were also
`position:fixed`. The string `border-bottom: 1px` CONTAINS `bottom: 1px`.
**The wider rule. This is the one that matters.** A property-name regex must
anchor to the start of a declaration. `bottom` is a suffix of `border-bottom`,
`margin-bottom` and `padding-bottom`. The same pass also matched 236 ordinary
card spacings on its first attempt before being scoped, so this rule cost two
mistakes on the same day.

### L-SMM-007 · the Delivery columns are defined in three files under two names
**Symptom.** `BBD_COLS` in `bb-smm-workspace` and `bb-command-centre`, and
`COLS` in `bb-delivery`. Searching for `BBD_COLS` finds two of three and looks
complete.
**Consequence.** Change the columns in two files and the three views disagree
about what a percentage means, silently.
**The block.** Harness checks `Delivery: the column set matches what this app
expects` and `Delivery: the four groups are intact`, which assert the shape this
app renders rather than trusting a grep.

### L-SMM-008 · `completed_at` was never stamped, so turnaround was unanswerable
**Symptom.** 308 of 529 finished tasks carry no finish time.
**Root cause.** `toggleTask` wrote only `done`. The column existed the whole
time and nothing filled it.
**Fixed 2026-08-22**, on the page and in the daily popup, which both write the
same row and so both had to agree. Un-ticking clears the stamp again.
**The wider rule.** When two code paths write the same row, fixing one is fixing
none. Find every writer before calling it done.

---

## HOW TO USE THIS FILE

Before changing anything in this system, read the OPEN section. Before shipping,
run the harness at desktop AND at 390px:

```
python3 ~/.claude/skills/bb-rock-solid/guard.py /Users/thulaibhassen/bb-smm-workspace/index.html
```

then open the page with `?selftest` on the end. `runSelfTest()` in the
console does the same thing.

**The harness performs zero database writes.** That is the whole reason it is
allowed to exist in a system that reads and writes live shared tables. Anything
added to it that writes must be removed instead.
