/* SMM WEEK IN REVIEW, the shared mould (23 Oct 2026). Used by build.mjs (one PDF by hand) and friday.mjs (the Friday job).
   Reads one SMM's week from the live tables (read only), counts EVERY number in code, asks DeepInfra for the words only,
   gates the words (house style, no numbers, no he or she), and draws the one page.
   TONE (Thulaib, 23 Oct: "I don't want it to feel like a prison"): written to the person as "you", kind first, nothing
   is "missed" or "failed", unfinished work is "carried to next week", no scores, no comparison with anyone else. */
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
export const HOME = process.env.HOME;
export const SB = 'https://yyviiwnqgphyklcoijyd.supabase.co/rest/v1/';
export const ANON = fs.readFileSync(path.join(HOME, 'bb-smm-workspace/index.html'), 'utf8').match(/const SMM_SB_KEY = '([^']+)'/)[1];   // the public key the app already ships
export const MODEL = 'deepseek-ai/DeepSeek-V4-Flash-0731'; const PRICE_IN = 0.06, PRICE_OUT = 0.18;            // claude-rail prices.json, verified 15 Oct
export const SEATS = ['Nirvana', 'Tiana', 'Hithesh'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const get = async q => { const r = await fetch(SB + q, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } }); if (!r.ok) throw new Error(q.split('?')[0] + ' HTTP ' + r.status); return r.json(); };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export function mondayOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const g = x.getDay(); x.setDate(x.getDate() - g + (g === 0 ? -6 : 1)); return iso(x); }

export async function gather(who, week) {
  const mon = new Date(week + 'T00:00:00'); const fri = new Date(mon); fri.setDate(fri.getDate() + 4); const sun = new Date(mon); sun.setDate(sun.getDate() + 7);
  const rows = await get(`smm_weekly_plan?week_start=eq.${week}&created_by=eq.${encodeURIComponent(who)}&order=day_of_week.asc,starts_at.asc.nullslast,id.asc`);
  const ideas = await get(`shared_ideas?captured_by=eq.${encodeURIComponent(who)}&captured_at=gte.${week}&captured_at=lt.${iso(sun)}&select=text,client_id`).catch(() => []);
  const clients = await get('clients?select=id,name');
  const cname = id => (clients.find(c => c.id === id) || {}).name || '';
  const min = t => t ? (+t.slice(0, 2)) * 60 + (+t.slice(3, 5)) : null;
  const timed = rows.filter(r => min(r.starts_at) != null && min(r.ends_at) > min(r.starts_at));
  const numbers = {
    tasks: rows.length, done: rows.filter(r => r.status === 'done').length, timed: timed.length,
    minutes: timed.reduce((a, r) => a + min(r.ends_at) - min(r.starts_at), 0),
    linked: rows.filter(r => /^https:\/\//.test(r.link || '')).length, ideas: ideas.length,
    clients: [...new Set(rows.map(r => r.client_name).filter(Boolean))].length
  };
  const facts = { week: `${mon.getDate()} to ${fri.getDate()} ${fri.toLocaleString('en-GB', { month: 'short' })}`,
    tasks: rows.map(r => ({ day: DAYS[r.day_of_week - 1], client: r.client_name || null, what: r.notes, finished: r.status === 'done', time: r.starts_at ? r.starts_at.slice(0, 5) + ' to ' + r.ends_at.slice(0, 5) : null, work_linked: !!r.link })),
    ideas_banked: ideas.map(i => ({ client: cname(i.client_id), idea: i.text })) };
  return { who, week, rows, numbers, facts };
}

const SYSTEM = `You write a short, kind weekly review for a social media manager at Business Booster, a marketing agency in Sri Lanka.
It is read by the person and by the COO who supports them. It is a coach's note, never a report card.
Voice: speak to the person as "you". Warm, plain and specific. Name real tasks and clients from the facts. Never use he, she or they for the person.
Rules: British English. Never use an em dash or an en dash. Never put a comma before "and", "or", "but" or "nor". No filler words like "delve", "leverage", "seamless", "robust", "journey", "testament".
Never write a number, in digits or in words; the page prints the numbers itself. Never compare the person with anyone. Never say missed, failed, behind or lazy: unfinished work is simply carried to next week. If a note says it waits on a client, say that.
Use ONLY the facts given. Never invent a task, client, idea or result.
Return JSON only: {"summary": "two or three sentences on the shape of the week, starting with what went well", "went_well": ["up to 3"], "carried": ["up to 3 unfinished tasks, said neutrally"], "next_week": ["up to 3 small, practical suggestions drawn from the carried work or the ideas"], "learned": "one sentence on what the week shows you practised; an empty string if the facts do not say"}`;
const NUMWORDS = /\b(\d+%?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|half|dozen)\b/gi;
const PRONOUN = /\b(she|he|her|him|his|hers)\b/i;
const BANNED = /\b(missed|failed|failing|behind|lazy|poor|should have)\b/i;
/* A number is refused unless the person typed it in their own plan (a task that says "fifteen talking points" may be quoted). */
function faults(txt, factsText) {
  const out = [], own = String(factsText || '').toLowerCase();
  txt.split('\n').forEach(l => { const bad = (l.match(NUMWORDS) || []).filter(n => !own.includes(n.toLowerCase())); if (bad.length) out.push('[FAIL] a number in the words: "' + bad.join('", "') + '" <- ' + l.slice(0, 70)); if (PRONOUN.test(l)) out.push('[FAIL] he or she used, write "you": "' + l.match(PRONOUN)[0] + '" <- ' + l.slice(0, 90)); if (BANNED.test(l)) out.push('[FAIL] a blaming word: "' + l.match(BANNED)[0] + '" <- ' + l.slice(0, 90)); });
  const tmp = path.join(process.env.TMPDIR || '/tmp', 'week-review-draft.txt'); fs.writeFileSync(tmp, txt);
  try { execFileSync('python3', [path.join(HOME, 'bb-consultancy/house_style.py'), tmp], { encoding: 'utf8' }); } catch (e) { String(e.stdout || '').split('\n').filter(l => l.includes('FAIL')).forEach(l => out.push(l)); }
  return out.join('\n');
}
/* Up to three drafts. A draft that breaks a rule goes back with the exact faults; the third failure refuses. */
export async function draft(g) {
  const DI = fs.readFileSync(path.join(HOME, '.bb-secrets/deepinfra.key'), 'utf8').trim();
  const msgs = [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(g.facts) }];
  const usage = { prompt_tokens: 0, completion_tokens: 0 }; let words = null, f = '', drafts = 0;
  while (drafts < 3) {
    drafts++;
    const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + DI, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 900, response_format: { type: 'json_object' }, messages: msgs }) });
    if (!res.ok) throw new Error('DeepInfra HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160));
    const j = await res.json(); usage.prompt_tokens += j.usage.prompt_tokens; usage.completion_tokens += j.usage.completion_tokens;
    const raw = j.choices[0].message.content.replace(/^```json|```$/g, '');
    words = JSON.parse(raw);
    ['went_well', 'carried', 'next_week'].forEach(k => { words[k] = (words[k] || []).filter(x => typeof x === 'string' && x.trim()).slice(0, 3); });
    words.summary = String(words.summary || ''); words.learned = String(words.learned || '');
    f = faults([words.summary, ...words.went_well, ...words.carried, ...words.next_week, words.learned].join('\n'), (g.rows || []).map(r => r.notes).join(' '));
    if (process.env.WR_DEBUG) console.error('draft ' + drafts + ':\n' + (f || 'clean'));
    if (!f) break;
    msgs.push({ role: 'assistant', content: raw }, { role: 'user', content: 'Rewrite. These lines break the rules, fix them and keep everything else:\n' + f });
  }
  if (f) throw new Error('REFUSED after 3 drafts:\n' + f);
  return { words, usage, drafts, usd: +((usage.prompt_tokens * PRICE_IN + usage.completion_tokens * PRICE_OUT) / 1e6).toFixed(6) };
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function pageHtml(g, w, tag) {
  const N = g.numbers, li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join('') || '<li>Nothing to note</li>';
  const hasClient = g.rows.some(r => r.client_name);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:14mm}body{font:10.5pt/1.4 -apple-system,Inter,Helvetica,sans-serif;color:#141820}
h1{font-size:20pt;margin:0 0 2px}.sub{color:#5b6472;margin-bottom:12px}.nums{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 14px}
.n{border:1px solid #dde2ea;border-radius:8px;padding:8px 10px}.n b{display:block;font-size:17pt}.n span{color:#5b6472;font-size:9pt}
h2{font-size:11.5pt;margin:10px 0 3px}ul{margin:0;padding-left:18px}li{margin:2px 0}table{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:4px}
td,th{border-bottom:1px solid #eef1f5;padding:3px 6px;text-align:left;vertical-align:top}td:last-child,th:last-child{white-space:nowrap}.foot{margin-top:12px;color:#8a93a1;font-size:8.5pt}</style></head><body>
<h1>${esc(g.who)}, your week</h1><div class="sub">${esc(g.facts.week)} 2026${tag ? '. ' + esc(tag) : ''}</div>
<p>${esc(w.summary)}</p>
<div class="nums"><div class="n"><b>${N.done} of ${N.tasks}</b><span>tasks finished</span></div><div class="n"><b>${N.timed}</b><span>tasks with a time</span></div>
<div class="n"><b>${N.linked}</b><span>with work linked</span></div><div class="n"><b>${N.ideas}</b><span>ideas banked</span></div></div>
<h2>Went well</h2><ul>${li(w.went_well)}</ul><h2>Carried to next week</h2><ul>${li(w.carried)}</ul><h2>For next week</h2><ul>${li(w.next_week)}</ul>
${w.learned ? `<h2>What the week shows</h2><p>${esc(w.learned)}</p>` : ''}
<h2>The week as planned</h2><table><tr><th>Day</th>${hasClient ? '<th>Client</th>' : ''}<th>Task</th><th>Finished</th></tr>${g.rows.map(r => `<tr><td>${DAYS[r.day_of_week - 1]}</td>${hasClient ? `<td>${esc(r.client_name || '')}</td>` : ''}<td>${esc(r.notes)}</td><td>${r.status === 'done' ? 'Yes' : 'Carried'}</td></tr>`).join('')}</table>
<div class="foot">Numbers counted from the Weekly Plan as typed. Words drafted by ${MODEL.split('/')[1]} on DeepInfra from those rows only.</div></body></html>`;
}
export async function pdf(html, out) {
  const { chromium } = require(path.join(HOME, 'bb-systems/batch/node_modules/playwright'));
  const browser = await chromium.launch(); try {
    const page = await browser.newPage(); await page.setContent(html); await page.pdf({ path: out, format: 'A4', printBackground: true });
  } finally { await browser.close(); }
  const pages = (fs.readFileSync(out, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  if (pages !== 1) { fs.unlinkSync(out); throw new Error('REFUSED: ' + pages + ' pages, the review is one page'); }
  return out;
}
export async function rpc(fn, body) {
  const tok = fs.readFileSync(path.join(HOME, '.bb-secrets/booster-brain.env'), 'utf8').match(/^BRAIN_PUT_TOKEN=(.*)$/m)[1].trim();
  const r = await fetch(SB + 'rpc/' + fn, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json', 'x-bb-brain-put': tok }, body: JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + ' ' + t.slice(0, 200)); return JSON.parse(t || 'null');
}
