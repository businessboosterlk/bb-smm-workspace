# LANDMINES · BB SMM Workspace

The register of failure classes found in this system. Prefix `L-SMM-`.
**Never delete an entry.** A fixed landmine stays, because the entry is what
stops the class coming back, not the fix.

Created 2026-08-22, when the self-test harness went in. Entries 001 to 004 and
007 to 010 are backfilled from work done between 30 July and 22 August. 005 and
006 were found by the harness on its first run. 011 to 015 came from the phone
sweep of 2026-09-04, after Thulaib said the system was not working on the phone.

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

### L-SMM-016 · the pillars save rebuilt the whole row and would have wiped the meals
**Found 2026-09-04 while building the three-meals strip, before it shipped.**
`syncPillarsToDb` built `state` from the pillar checkboxes alone and upserted
the whole row. The meals strip stores its timestamps in the same row under
`state.meals`, so every pillar tick would have deleted the day's meal record.
The Video System writes its own keys into this table too, so the class was
already live for it.
**Fixed before shipping.** Both writers read the row, merge their own keys and
upsert. Same class as L-SMM-008: two writers, one row. **Before adding a key
to a shared jsonb column, read every writer of that column.**
**Verified.** A meal tick landed as a timestamp under `meals` with the rest of
the row untouched, then was reverted.


### L-SMM-011 · page headers do not wrap, so two pages are wider than the phone
**Symptom, measured 2026-09-04 at 375px and again at 320px.** Shoot Pipeline is
**591px wide** on a 375px screen and the whole page drags sideways. Weekly Plan
is 396px. Video Hub's title is crushed into a four-word column beside its
buttons. This is what "not working on the phone" looks like from the hand.
**Root cause.** `.ph-right { flex-shrink: 0 }` and the 768px breakpoint has no
rule for `.ph` at all, so the two filter selects and a button (482px together)
refuse to shrink or wrap and push the page out. Weekly Plan's inner button row
has no `flex-wrap` either.
**Why the harness missed it.** Its no-sideways-scroll check ran ONCE, on
whichever page was current at the end of the walk, which is SOPs. Every page
walked green while two of them were wider than the screen. The check must run
INSIDE the page loop, per page. Fixed in the harness alongside the page fix.
**The block.** Per-page `Layout: <page> does not scroll sideways` checks.
**Fixed 2026-09-04.** At 768px `.ph` stacks, `.ph-right` wraps and shrinks, the
Weekly Plan row wraps. Measured after at 375px: all 16 pages exactly 375px
wide, at 320px all 12 walked pages exactly 320px. The harness now runs the
sideways check inside the page loop, one result per page.

### L-SMM-012 · tap targets are built for a mouse
**Symptom, measured at 375px.** My Tasks: 238 of 241 tap targets under 32px.
Delivery: 322 of 325, the tick boxes are 19px. Video Hub: 404 of 404. Today: the
"more" buttons are 17px tall. The task tick circle is 17px. Apple's floor is
44pt, Google's 48dp. A thumb hits the box next to the one it meant.
**Root cause.** `.btn-sm { padding: 5px 10px }`, `.task-check { 17px }`, the
Delivery tick `width:19px;height:19px` inline, `.vh-card-menu` 19x20, `.sb-item
{ padding: 8px 10px }`. All sized for a cursor and never revisited for a finger.
**The block, when built.** A `@media (pointer:coarse)` layer that raises every
interactive element to a 44px hit area (a 22px tick can keep its look and still
own a 44px touch box via padding or `::before`), and a harness check that counts
interactive elements under 40px at coarse pointer and FAILS above zero.
**Fixed 2026-09-04.** A `@media (pointer:coarse)` layer, cascade-final. Most of
the small controls turned out to be INLINE styles built by JavaScript, which a
class selector never reaches, so the layer targets element types with
`!important` and reaches inline text through `[style*="font-size:9px"]`.
Ticks keep their look and own a 44px hit box through `::before`. A checkbox's
row is its target. Measured after: zero tap targets under 36px on all 16 pages
at 375px, from 238 of 241 on My Tasks and 322 of 325 on Delivery. Harness
checks `Touch: <page> has no tap target under 36px`, per page.

### L-SMM-013 · the side menu is not an overlay the foundation layer knows about
**Symptom, measured 2026-09-04.** Tap the hamburger: the menu slides in. The
page behind still scrolls, nothing is `inert`, Back leaves the app instead
of closing the menu. The hamburger ends up underneath the open menu.
Tapping the backdrop closes it, so it is usable. It still breaks three of
the nine phone rules. The sidebar also has no `--sat` inset, so on a real
handset the logo sits under the Dynamic Island.
**Root cause.** `BBF`'s overlay selector lists `.modal-bg`, the check-in overlay
and the two drawer backdrops. `.sidebar-backdrop` is not in it, so freeze,
inert and Back are never applied. The 768px block sets the sidebar width and
transform and nothing else.
**The block, when built.** Add `.sidebar-backdrop` to the overlay selector and
`.sidebar` to KEEP, one line each. The three behaviours are inherited.
`.sidebar { padding-top: var(--sat) }` at 768px.
**Fixed 2026-09-04.** `.sidebar-backdrop` added to the foundation layer's overlay
selector and `.sidebar` to its keep list, one line each; `closeTop` clicks any
backdrop that carries an onclick. Measured after: opening the menu pins the
body, marks the page inert. Back closes the menu without leaving the app.
`.sidebar` carries `padding-top: var(--sat)` at 768px.

### L-SMM-014 · the PIN box brings up the letter keyboard
**Symptom.** The login PIN is `type="password"` with no `inputmode`, so a
four-digit number gets a full QWERTY keyboard every single morning. iOS
offers to save it as a website password. The keyboard's action key reads "next"
on the last field because the foundation layer's hint scope does not include
the login card.
**The block, when built.** `inputmode="numeric" pattern="[0-9]*"
autocomplete="one-time-code"`, the login card added to the hint scope. The
name is remembered so the morning login is one tap and four digits.
**Fixed 2026-09-04.** `inputmode="numeric" pattern="[0-9]*"
autocomplete="one-time-code" enterkeyhint="go"` on the PIN; the login card is in
the keyboard-hint scope; the name is remembered on the device (never the PIN),
filled in on load, cursor waiting in the PIN box. Verified by attribute on the
rendered field.

### L-SMM-015 · type below 11px on a phone
**Symptom.** `.round` at 7.5px (the JULY / AUGUST group labels on Delivery),
`.sb-sub` and `.wp-sec-label` at 8px, `.cp-field-lbl` at 8.5px, twenty-odd
selectors at 9px, 163 declarations at 10px or under. Video Hub renders 608 text
elements under 11px at phone width. Unreadable without pinching.
**The block, when built.** A coarse-pointer floor: nothing renders under 11px. The Delivery group labels go to 10px. Harness check counts visible text
under 11px and FAILS above a stated allowance.
**Fixed 2026-09-04.** Floor of 10px on a coarse pointer: named selectors to 11px,
Delivery group labels to 10px. Five attribute selectors that reach the 72
inline sizes from 7.5px to 9.5px. Measured after: zero text under 10px on all
16 pages at 375px, from 608 elements on Video Hub. Harness check
`Type: <page> has nothing to read under 10px`, per page.


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

### L-SMM-017 · Today's agenda rows were 18px tall on the phone
**Found:** 2026-09-04, by the harness's per-page touch check, only once a task
fell due on the day of the run. **Status:** FIXED.
`.ta-row` (tasks due, posts due, approvals, community mentions on Today) is a
13px flex row with no height, so on a phone it was an 18px tap target. Every
earlier phone run passed because nothing was due that day, so the rows did not
exist. Fixed in the `pointer:coarse` layer: `min-height:40px`.
**Lesson:** a render-only check sees what the data draws. Run the harness on a
day with data in every list or seed the list first. Otherwise the check is a
coin toss.

### L-SMM-018 · A `var` in a long function silently reused an earlier name
**Found:** 2026-09-04, by the Sentinel banner on the first run of the recap
meals block: "rows.filter is not a function". **Status:** FIXED.
`renderRecap` builds a per-client `rows` array. The meals block added below it
declared `var rows = await mealsRowsForSeat(...)`, and `var` is function-scoped,
so the array became an object and the table build failed. Renamed to `mrows`.
**Lesson:** in this file every function is one long `var` scope. Before adding a
block to a function, grep that function for the names you are about to declare.
The Sentinel banner is what caught it, so leave it on.

### L-SMM-019 · churned clients stayed in the meals strip
**Found:** 2026-09-04, live, first day of three meals. **Status:** FIXED.
`clients.assigned_smm` keeps its value after a client churns, so `S_myClientIds`
carried Excellent and LGL for Nirvana and Guiding Steps for Tiana. The strip
listed 13 pages, `mealExpected()` and the server's `bb_meals_check()` counted 11
active. A seat could have been told "done" at 27 ticks with two pages unticked
or nagged for pages of clients who left. `mealClients()` now skips `ended` and
`churned`, and harness check "Meals: the strip and the expected count agree on
clients" fails if the two ever drift again.
**Lesson:** three places count the same thing (screen, expected, server). Write
the check that compares them before the first day, not after.

### L-SMM-020 · a zero-width preview pane read as sixteen broken pages
**Found:** 2026-09-05, verifying the ported push block. **Status:** FIXED.
A freshly opened preview pane reports `innerWidth` 0. Every per-page check
`scrollWidth <= innerWidth + 1` then compares a real width against nothing, so
all sixteen pages failed at once on a file whose only change was inside a
script block. The first reading of that report was "I have broken every page",
which is the expensive part: it is a false alarm that looks exactly like a
disaster. `bb-app-foundations` names this trap ("if a whole suite goes red
together, read the viewport before reading the code") and the harness did not
know it. Now one named check, `Viewport: the pane is a real size to measure`,
fails with the measured size and SKIPS the layout checks rather than letting
them lie. Proven by forcing `innerWidth` to 0: the run goes 116 to 101 checks
with the viewport check red and zero layout checks attempted.
**Lesson:** a check that reports a FALSE failure costs nearly as much as one
that passes wrongly, because it spends the trust you need when a real failure
comes. Any check whose verdict depends on an environment reading must test
that reading first.

### L-SMM-021 · the push block drifted between apps in both directions
**Found:** 2026-09-05. **Status:** FIXED in SMM, open elsewhere.
The `@@BB_PUSH_BEGIN@@` block is meant to be identical in every app bar three
lines. It was not. SMM was missing the 4 September no-hang fix (timeouts on
every await, register the worker if it is missing) and the `diagnose()` used by
the Settings sheet, and it wrote its localStorage keys WITHOUT the app suffix,
which matters because all six apps share one origin, so dismissing the banner
in one app dismissed it in all of them. Meanwhile SMM alone had the better
pill, which hides a state a tap cannot change instead of parking "Alerts
blocked" over the page forever on iOS Safari.
**Lesson:** a block copied into five files drifts in BOTH directions, so the
merge is never one-way. Diff every copy against every other before porting,
and carry the best of each back. The four other apps are still on the worse
pill: that is an open item, not a done one.
