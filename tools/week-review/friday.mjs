/* THE FRIDAY JOB (launchd, Fridays 17:00 Colombo; runs on wake if the Mac slept through it).
   For each SMM with at least one row this week: gather, draft, write the review through bb_week_review_put (token checked),
   keep a PDF copy in ~/Downloads/BB-SMM-Week-Reviews, log the cost. RELEASE is a separate decision:
   while HOLD exists in this folder, the reviews stay held (visible to Thulaib and Shiara in the app, nobody notified).
   Without HOLD, the week is released: the SMM sees it and one push goes to the SMM and Shiara.
   Run by hand: ~/.local/node/bin/node tools/week-review/friday.mjs [--week 2026-10-19] [--dry] */
import fs from 'fs'; import path from 'path'; import url from 'url';
import { execFile } from 'child_process';
import { gather, draft, pageHtml, pdf, rpc, mondayOf, isNetwork, SEATS, MODEL, HOME } from './lib.mjs';
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const week = arg('--week') || mondayOf(new Date()); const dry = process.argv.includes('--dry');
const hold = fs.existsSync(path.join(HERE, 'HOLD'));
const LOG = path.join(HOME, 'bb-brain/usage/task-ledger.jsonl');
const outDir = path.join(HOME, 'Downloads', 'BB-SMM-Week-Reviews'); fs.mkdirSync(outDir, { recursive: true });
const report = []; let usd = 0; const failed = []; let netFails = 0;
for (const who of SEATS) {
  try {
    const g = await gather(who, week);
    if (!g.rows.length) { report.push(`${who}: no tasks typed in the Weekly Plan this week, no review`); continue; }
    const d = await draft(g); usd += d.usd;
    await pdf(pageHtml(g, d.words, hold ? 'Held for review' : ''), path.join(outDir, `${who}-${week}.pdf`));
    if (dry) { report.push(`${who}: drafted in ${d.drafts}, NOT written (dry)`); continue; }
    const id = await rpc('bb_week_review_put', { p_seat: who, p_week: week, p_numbers: g.numbers, p_words: d.words, p_model: MODEL, p_usd: d.usd });
    report.push(`${who}: written as review ${id}, ${d.drafts} draft(s)`);
  } catch (e) { const m = String(e.message || e).split('\n')[0]; report.push(`${who}: FAILED ${m}`); failed.push(`${who}: ${m}`); if (isNetwork(e)) netFails++; }
}
if (!dry && !hold) { try { const r = await rpc('bb_week_review_release', { p_week: week, p_dry: false }); (r || []).forEach(x => report.push(`release ${x.seat}: ${x.note}`)); } catch (e) { report.push('release FAILED ' + e.message); failed.push('release: ' + e.message); if (isNetwork(e)) netFails++; } }
const line = `SMM week review ${week}${dry ? ' (dry)' : hold ? ' (HELD)' : ' (released)'}: ${report.join(' | ')}. USAGE: DeepInfra ${usd.toFixed(5)} USD`;
try { fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), event: 'routine', routine: 'smm-week-review', note: line, usd }) + '\n'); } catch (e) {}
console.log(line);
/* THE SHOUT (10 Nov 2026). Three Fridays failed in silence. Any failure now leaves WEEK-REVIEW-FAILING.txt in this folder,
   raises a Mac notification and ends with exit code 1; the next clean run removes the note. A dry run uses its own note
   (WEEK-REVIEW-FAILING.dry.txt) and no notification, so a test can never clear or raise the real one. */
const NOTE = path.join(HERE, dry ? 'WEEK-REVIEW-FAILING.dry.txt' : 'WEEK-REVIEW-FAILING.txt');
if (failed.length) {
  const what = netFails === failed.length ? 'THE NETWORK FAILED on every try' : netFails ? 'part network, part other' : 'not a network fault';
  fs.writeFileSync(NOTE, `SMM week review ${week} did NOT finish clean (${what}).\nRun at ${new Date().toString()}\n\n${failed.join('\n')}\n\nNothing is sent twice by running it again: a written review is replaced, a released one is never rewritten.\nRun again by hand: ~/.local/node/bin/node ~/bb-smm-workspace/tools/week-review/friday.mjs --week ${week}\nTest without writing: add --dry\nThis note is removed by the next clean run.\n`);
  if (!dry) execFile('osascript', ['-e', `display notification "${failed.length} part(s) failed. Read WEEK-REVIEW-FAILING.txt in tools/week-review" with title "SMM week review did not run clean" sound name "Basso"`], () => {});
  process.exitCode = 1;
} else if (fs.existsSync(NOTE)) fs.unlinkSync(NOTE);
