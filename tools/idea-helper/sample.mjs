/* SAMPLE BEFORE SCALE: ideas for a few clients as one PDF in ~/Downloads. Reads only; writes nothing to the database.
   Run: ~/.local/node/bin/node tools/idea-helper/sample.mjs 20 6 */
import path from 'path'; import { gather, suggest, sampleHtml, pdf, HOME } from './lib.mjs';
const ids = process.argv.slice(2).map(Number).filter(Boolean);
const blocks = []; let usd = 0;
for (const id of ids) { const g = await gather(id); const s = await suggest(g); usd += s.usd; blocks.push({ g, s }); console.error(g.client.name + ': ' + s.drafts + ' draft(s), ' + s.usd + ' USD'); }
const out = path.join(HOME, 'Downloads', 'BB-SMM-Idea-Helper-SAMPLE.pdf');
const pages = await pdf(sampleHtml(blocks), out);
console.log(JSON.stringify({ out, pages, usd: +usd.toFixed(5) }));
