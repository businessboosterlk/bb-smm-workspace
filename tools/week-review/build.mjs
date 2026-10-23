/* One review as a PDF, by hand, written to ~/Downloads. Nothing is written to the database.
   Run: ~/.local/node/bin/node tools/week-review/build.mjs Nirvana 2026-10-19 */
import path from 'path'; import { gather, draft, pageHtml, pdf, HOME } from './lib.mjs';
const [who, week] = process.argv.slice(2);
if (!who || !/^\d{4}-\d{2}-\d{2}$/.test(week || '')) { console.error('usage: build.mjs <Name> <Monday YYYY-MM-DD>'); process.exit(2); }
const g = await gather(who, week); const d = await draft(g);
const out = await pdf(pageHtml(g, d.words, 'SAMPLE'), path.join(HOME, 'Downloads', `BB-SMM-Week-Review-${who}-${week}-SAMPLE.pdf`));
console.log(JSON.stringify({ out, drafts: d.drafts, numbers: g.numbers, usd: d.usd }));
