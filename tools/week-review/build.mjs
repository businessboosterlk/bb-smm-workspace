/* SMM WEEK IN REVIEW, SAMPLE MOULD (23 Oct 2026). One SMM, one week, one A4 page.
   Reads the week from the live tables (read only), computes EVERY number in code, asks DeepInfra for the words
   only, refuses on house style, renders a PDF to ~/Downloads. Nothing is written to the database.
   Run: ~/.local/node/bin/node tools/week-review/build.mjs Nirvana 2026-10-19 */
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.HOME, 'bb-systems/batch/node_modules/playwright'));
const [who, week] = process.argv.slice(2);
if (!who || !/^\d{4}-\d{2}-\d{2}$/.test(week || '')) { console.error('usage: build.mjs <Name> <Monday YYYY-MM-DD>'); process.exit(2); }
const SB = 'https://yyviiwnqgphyklcoijyd.supabase.co/rest/v1/';
const KEY = fs.readFileSync(path.join(process.env.HOME, 'bb-smm-workspace/index.html'), 'utf8').match(/const SMM_SB_KEY = '([^']+)'/)[1];   // the public read key the app already ships
const DI = fs.readFileSync(path.join(process.env.HOME, '.bb-secrets/deepinfra.key'), 'utf8').trim();
const MODEL = 'deepseek-ai/DeepSeek-V4-Flash-0731', PRICE_IN = 0.06, PRICE_OUT = 0.18;   // claude-rail prices.json, verified 15 Oct
const get = async q => { const r = await fetch(SB + q, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }); if (!r.ok) throw new Error(q + ' HTTP ' + r.status); return r.json(); };
const mon = new Date(week + 'T00:00:00'); const fri = new Date(mon); fri.setDate(fri.getDate() + 4);
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const rows = await get(`smm_weekly_plan?week_start=eq.${week}&created_by=eq.${encodeURIComponent(who)}&order=day_of_week.asc,starts_at.asc`);
const ideas = await get(`shared_ideas?captured_by=eq.${encodeURIComponent(who)}&captured_at=gte.${week}&captured_at=lt.${iso(new Date(fri.getTime() + 3 * 864e5))}&select=text,client_id,status`).catch(() => []);
const meals = await get(`daily_pillar_state?user_name=eq.${who.toUpperCase()}&pillar_date=gte.${week}&pillar_date=lte.${iso(fri)}&select=pillar_date,state`).catch(() => []);
const clients = await get('clients?select=id,name');
const cname = id => (clients.find(c => c.id === id) || {}).name || '';
/* NUMBERS, in code */
const min = t => t ? (+t.slice(0, 2)) * 60 + (+t.slice(3, 5)) : null;
const timed = rows.filter(r => min(r.starts_at) != null && min(r.ends_at) > min(r.starts_at));
const N = {
  tasks: rows.length, done: rows.filter(r => r.status === 'done').length,
  timed: timed.length, minutes: timed.reduce((a, r) => a + min(r.ends_at) - min(r.starts_at), 0),
  proof: rows.filter(r => /^https:\/\//.test(r.link || '')).length,
  ideas: ideas.length,
  meals: meals.reduce((a, m) => a + Object.values((m.state && m.state.meals) || {}).filter(x => x && Object.keys(x).length).length, 0),
  clients: [...new Set(rows.map(r => r.client_name).filter(Boolean))]
};
const open = rows.filter(r => r.status !== 'done');
const facts = { person: who, week: `${mon.getDate()} to ${fri.getDate()} ${fri.toLocaleString('en-GB', { month: 'short' })}`, numbers: N,
  tasks: rows.map(r => ({ day: DAYS[r.day_of_week - 1], client: r.client_name, what: r.notes, done: r.status === 'done', time: r.starts_at ? r.starts_at.slice(0, 5) + ' to ' + r.ends_at.slice(0, 5) : null, has_link: !!r.link })),
  ideas: ideas.map(i => ({ client: cname(i.client_id), idea: i.text })) };
/* WORDS, from DeepInfra, as JSON only */
const system = `You write a one page weekly review for a social media manager at Business Booster, a marketing agency in Sri Lanka.
Rules: British English. Never use an em dash or an en dash. Never put a comma before "and", "or", "but" or "nor". No filler words like "delve", "leverage", "seamless", "robust", "journey", "testament". Plain short sentences, warm and direct, never pushy. Write to the person as "you"; never use he, she or they for them.
Use ONLY the facts given. Never invent a task, client, number or result. Never write a number, in digits or in words (no "six", "ten", "all" counts); the page prints the numbers itself.
Return JSON only: {"summary": "two or three sentences on the week", "went_well": ["up to 3"], "slipped": ["up to 3, kind"], "next_week": ["3 concrete suggestions drawn from what was not done or from the ideas"], "learned": "one sentence on what the week shows you practised; an empty string if the facts do not say"}`;
const t0 = Date.now();
/* Up to three drafts. A draft that breaks house style goes back with the exact faults; the third failure refuses the build. */
/* bb-number-lock: the words carry no numbers, so no number on the page can disagree with the counts. */
const NUMWORDS = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|half|dozen)\b/i;
const styleFaults = txt => { const nums = txt.split('\n').filter(l => NUMWORDS.test(l)); if (nums.length) return nums.map(l => '[FAIL] a number in the words <- ' + l.slice(0, 90)).join('\n'); const tmp = path.join(process.env.TMPDIR || '/tmp', 'week-review-draft.txt'); fs.writeFileSync(tmp, txt); try { execFileSync('python3', [path.join(process.env.HOME, 'bb-consultancy/house_style.py'), tmp], { encoding: 'utf8' }); return ''; } catch (e) { return String(e.stdout || '').split('\n').filter(l => l.includes('FAIL')).join('\n'); } };
let W = null, j = null, usage = { prompt_tokens: 0, completion_tokens: 0 }, faults = '', drafts = 0;
const msgs = [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(facts) }];
while (drafts < 3) {
  drafts++;
  const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + DI, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 900, response_format: { type: 'json_object' }, messages: msgs }) });
  if (!res.ok) { console.error('DeepInfra HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200)); process.exit(1); }
  j = await res.json(); usage.prompt_tokens += j.usage.prompt_tokens; usage.completion_tokens += j.usage.completion_tokens;
  const raw = j.choices[0].message.content.replace(/^```json|```$/g, '');
  W = JSON.parse(raw);
  faults = styleFaults([W.summary, ...(W.went_well || []), ...(W.slipped || []), ...(W.next_week || []), W.learned].join('\n'));
  if (!faults) break;
  msgs.push({ role: 'assistant', content: raw }, { role: 'user', content: 'Rewrite. These lines break the house rules, fix them and keep everything else:\n' + faults });
}
if (faults) { console.error('REFUSED after 3 drafts, house style:\n' + faults); process.exit(1); }
j.usage = usage;
const usd = (usage.prompt_tokens * PRICE_IN + usage.completion_tokens * PRICE_OUT) / 1e6;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const li = a => (a || []).filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('') || '<li>Nothing recorded</li>';
const hm = m => `${Math.floor(m / 60)} h ${m % 60} min`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:14mm}body{font:10.5pt/1.4 -apple-system,Inter,Helvetica,sans-serif;color:#141820}
h1{font-size:20pt;margin:0 0 2px}.sub{color:#5b6472;margin-bottom:14px}.nums{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 16px}
.n{border:1px solid #dde2ea;border-radius:8px;padding:8px 10px}.n b{display:block;font-size:17pt}.n span{color:#5b6472;font-size:9pt}
h2{font-size:11.5pt;margin:10px 0 3px}ul{margin:0;padding-left:18px}li{margin:2px 0}table{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:4px}
td,th{border-bottom:1px solid #eef1f5;padding:3px 6px;}td:last-child,th:last-child{white-space:nowrap}td,th{text-align:left;vertical-align:top}.foot{margin-top:14px;color:#8a93a1;font-size:8.5pt}</style></head><body>
<h1>${esc(who)}, week in review</h1><div class="sub">${esc(facts.week)} 2026. SAMPLE built from the Weekly Plan as typed.</div>
<p>${esc(W.summary)}</p>
<div class="nums"><div class="n"><b>${N.done} of ${N.tasks}</b><span>tasks done</span></div><div class="n"><b>${N.timed}</b><span>tasks with a time</span></div>
<div class="n"><b>${N.proof}</b><span>tasks with a link to the work</span></div><div class="n"><b>${N.ideas}</b><span>ideas banked</span></div></div>
<h2>Went well</h2><ul>${li(W.went_well)}</ul><h2>Slipped</h2><ul>${li(W.slipped)}</ul><h2>Next week</h2><ul>${li(W.next_week)}</ul>
${W.learned ? `<h2>What the week shows</h2><p>${esc(W.learned)}</p>` : ''}
<h2>The week as planned</h2><table><tr><th>Day</th>${N.clients.length ? '<th>Client</th>' : ''}<th>Task</th><th>Done</th></tr>${rows.map(r => `<tr><td>${DAYS[r.day_of_week - 1]}</td>${N.clients.length ? `<td>${esc(r.client_name || '')}</td>` : ''}<td>${esc(r.notes)}</td><td>${r.status === 'done' ? 'Yes' : 'Not yet'}</td></tr>`).join('')}</table>
<div class="foot">Numbers counted from the Weekly Plan. Words drafted by ${MODEL.split('/')[1]} on DeepInfra from those rows only. Time logged: ${hm(N.minutes)}.</div></body></html>`;
const browser = await chromium.launch(); const page = await browser.newPage(); await page.setContent(html);
const text = await page.evaluate(() => document.body.innerText);
const tmp = path.join(process.env.TMPDIR || '/tmp', 'week-review.txt'); fs.writeFileSync(tmp, text);
let style = ''; try { style = execFileSync('python3', [path.join(process.env.HOME, 'bb-consultancy/house_style.py'), tmp], { encoding: 'utf8' }); } catch (e) { style = String(e.stdout || e); }
if (/\[FAIL\]/.test(style)) { console.error('REFUSED, house style:\n' + style.split('\n').filter(l => l.includes('FAIL')).join('\n')); await browser.close(); process.exit(1); }
const out = path.join(process.env.HOME, 'Downloads', `BB-SMM-Week-Review-${who}-${week}-SAMPLE.pdf`);
await page.pdf({ path: out, format: 'A4', printBackground: true });
const pages = (fs.readFileSync(out, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
await browser.close();
if (pages !== 1) { fs.unlinkSync(out); console.error('REFUSED: ' + pages + ' pages, the review is one page'); process.exit(1); }
console.log(JSON.stringify({ out, pages, drafts, numbers: N, tokens: j.usage, usd: +usd.toFixed(5), ms: Date.now() - t0 }));
