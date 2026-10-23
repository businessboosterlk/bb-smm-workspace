/* SMM IDEA HELPER, the mould (23 Oct 2026, Thulaib: "start the idea helper").
   Why: from November each SMM originates at least half of every client's posts, stories and videos, each with a purpose
   (memory smm-three-way-split-and-half-the-ideas). The helper SUGGESTS, the SMM decides: a kept idea is edited and owned by
   the SMM, a dropped one costs nothing. It never replaces the SMM's own ideas and it never writes to a client.
   Grounding, read only: the client's staff brain (bb_client_brain, never the owners' copy), its content pillars, what is
   already planned this month (so nothing repeats), the team's Inspo Hub links for that client, and dates BB is sure of.
   Gate: house style, no invented price, offer, discount or giveaway, no date outside the given list, every idea names a pillar
   that exists, an objective and a funnel stage from the fixed lists. Up to three drafts, then refuse. */
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
export const HOME = process.env.HOME;
export const SB = 'https://yyviiwnqgphyklcoijyd.supabase.co/rest/v1/';
export const ANON = fs.readFileSync(path.join(HOME, 'bb-smm-workspace/index.html'), 'utf8').match(/const SMM_SB_KEY = '([^']+)'/)[1];
export const MODEL = 'deepseek-ai/DeepSeek-V4-Pro'; const PRICE_IN = 1.3, PRICE_OUT = 2.6;   // ask-bb-doors ladder.json "reason", verified 15 Oct
const get = async q => { const r = await fetch(SB + q, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } }); if (!r.ok) throw new Error(q.split('?')[0] + ' HTTP ' + r.status); return r.json(); };
export const OBJECTIVES = ['reach new people', 'start conversations', 'bring enquiries or orders', 'build trust', 'bring past customers back'];
export const STAGES = ['aware', 'consider', 'buy', 'stay'];
export const FORMATS = ['post', 'story', 'reel'];
/* Dates BB is sure of. A festival whose date moves (Deepavali, Poya days, Ramadan) is NOT listed until a person confirms it. */
export const SURE_DATES = [{ date: '2026-11-27', name: 'Black Friday' }, { date: '2026-12-25', name: 'Christmas' }, { date: '2026-12-31', name: 'New Year\'s Eve' }, { date: '2027-01-01', name: 'New Year\'s Day' }, { date: '2027-01-14', name: 'Thai Pongal' }, { date: '2027-02-04', name: 'Independence Day' }];

export async function gather(clientId) {
  const [c] = await get(`clients?id=eq.${clientId}&select=id,name,industry,assigned_smm,monthly_posts,monthly_videos,monthly_stories`);
  if (!c) throw new Error('no client ' + clientId);
  /* The brain is private: read through bb_brain_read with the Mac's brain token, STAFF copy only (never the owners' copy with money). */
  const tok = fs.readFileSync(path.join(HOME, '.bb-secrets/booster-brain.env'), 'utf8').match(/^ASKBB_BRAIN_TOKEN=(.*)$/m)[1].trim();
  const br = await fetch(SB + 'rpc/bb_brain_read', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json', 'x-bb-brain': tok }, body: JSON.stringify({ p_client: c.name, p_owner: false }) });
  if (!br.ok) throw new Error('bb_brain_read HTTP ' + br.status);
  const brain = (await br.json())[0];
  const pillars = await get(`client_pillars?client_id=eq.${clientId}&select=pillar_name,description,target_share&order=pillar_no.asc`);
  const now = new Date();
  /* What is already being made: the graphic and video boards (content_plans is empty for most clients). Titles only, never image_url. */
  const since = new Date(now.getTime() - 30 * 864e5).toISOString().slice(0, 10);
  const gfx = await get(`graphic_projects?client_id=eq.${clientId}&created_at=gte.${since}&select=title,type&limit=80`).catch(() => []);
  const vid = await get(`video_projects?client_id=eq.${clientId}&created_at=gte.${since}&select=title,type&limit=80`).catch(() => []);
  const planned = gfx.concat(vid).filter(p => p.title);
  const inspo = await get(`inspo_links?client_id=eq.${clientId}&dead_at=is.null&select=title,notes,category,platform&order=date_added.desc&limit=12`).catch(() => []);
  return { client: c, brain: brain ? brain.text.slice(0, 9000) : '', brainDate: brain && brain.file_date, pillars, planned, inspo };
}

const SYSTEM = `You are a senior social media strategist at Business Booster, a marketing agency in Sri Lanka. You suggest content ideas to the client's social media manager (SMM). The SMM chooses, edits and owns every idea; yours are a starting point, so make each one specific enough to make this week.
Rules for every idea:
- Grounded: it must come from a fact in the client brain, a pillar, an Inspo Hub link or a date given. Say which in "why".
- Never invent a price, an offer, a discount, a sale, a giveaway, a product, a set size, an award or a statistic. Never imply a lower price ("for less", "save", "deal") unless the client brain names a current offer. Never promise a result.
- Never make a promise on the client's behalf about replies, delivery times or service. Never build an idea on an internal problem the brain records (complaints, unanswered messages, staff or payment issues): those are for the SMM to fix, never for the audience.
- Only use a date from the dates list. Never name a competitor.
- Do not repeat anything already planned this month.
- Mix the formats: at least one post, one story and one reel.
- "objective" is exactly one of: ${OBJECTIVES.join('; ')}. "stage" is exactly one of: ${STAGES.join(', ')}. "pillar" is exactly one pillar name given, or "none" if the client has no pillars.
- Writing: British English, plain and specific. Never use an em dash or an en dash. Never put a comma before "and", "or", "but" or "nor". No filler words like "delve", "leverage", "seamless", "robust", "elevate", "unlock", "journey".
Return JSON only: {"ideas":[{"format":"post|story|reel","title":"short working title","hook":"the first line or the first three seconds","shows":"what is on screen or in the frame, one or two sentences","objective":"","stage":"","pillar":"","why":"one sentence naming the fact it rests on","effort":"low|medium|high (high means a shoot)"}]}  Exactly three ideas.`;

const BANNED = /\b(discount|% off|sale|giveaway|free gift|cheapest|best in sri lanka|guarantee[ds]?|rs\.?\s?\d|lkr\s?\d|for less|save (big|more|now)|deals?\b|price drop|special offer|limited offer|every (message|comment|dm)|reply within|we reply|replies? to every|unanswered)/i;
function faults(ideas, g) {
  const out = [];
  if (!Array.isArray(ideas) || ideas.length !== 3) out.push('[FAIL] exactly three ideas are needed, got ' + (ideas || []).length);
  const pillarNames = g.pillars.map(p => p.pillar_name.toLowerCase());
  const own = (g.brain + ' ' + g.inspo.map(i => (i.title || '') + ' ' + (i.notes || '')).join(' ')).toLowerCase();
  (ideas || []).forEach((it, i) => {
    const n = 'idea ' + (i + 1);
    if (!FORMATS.includes(it.format)) out.push(`[FAIL] ${n}: format must be post, story or reel`);
    if (!OBJECTIVES.includes(it.objective)) out.push(`[FAIL] ${n}: objective must be one of the list exactly`);
    if (!STAGES.includes(it.stage)) out.push(`[FAIL] ${n}: stage must be one of the list exactly`);
    if (pillarNames.length ? !pillarNames.includes(String(it.pillar || '').toLowerCase()) : it.pillar !== 'none') out.push(`[FAIL] ${n}: pillar must be one of the pillar names given`);
    const txt = [it.title, it.hook, it.shows, it.why].join(' ');
    const b = txt.match(BANNED); if (b && (!own.includes(b[0].toLowerCase()) || /every|reply|unanswered/i.test(b[0]))) out.push(`[FAIL] ${n}: an offer, price or promise nobody approved: "${b[0]}"`);
    (txt.match(/\b\d{1,2}(st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi) || []).forEach(d => out.push(`[FAIL] ${n}: a date "${d}" is not allowed; use the date's name from the list`));
  });
  const tmp = path.join(process.env.TMPDIR || '/tmp', 'idea-draft.txt');
  fs.writeFileSync(tmp, (ideas || []).map(it => [it.title, it.hook, it.shows, it.why].join('\n')).join('\n'));
  try { execFileSync('python3', [path.join(HOME, 'bb-consultancy/house_style.py'), tmp], { encoding: 'utf8' }); } catch (e) { String(e.stdout || '').split('\n').filter(l => l.includes('FAIL')).forEach(l => out.push(l)); }
  return out.join('\n');
}
export async function suggest(g) {
  const DI = fs.readFileSync(path.join(HOME, '.bb-secrets/deepinfra.key'), 'utf8').trim();
  const today = new Date().toISOString().slice(0, 10);
  const facts = { client: g.client.name, industry: g.client.industry, monthly: { posts: g.client.monthly_posts, stories: g.client.monthly_stories, videos: g.client.monthly_videos },
    pillars: g.pillars, already_planned_this_month: g.planned.map(p => p.title).filter(Boolean),
    inspo_hub_links_for_this_client: g.inspo.map(i => ({ title: i.title, note: i.notes, kind: i.category, platform: i.platform })),
    dates: SURE_DATES.filter(d => d.date >= today).slice(0, 4), client_brain: g.brain };
  const msgs = [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(facts) }];
  const usage = { in: 0, out: 0 }; let ideas = null, f = '', drafts = 0;
  while (drafts < 3) {
    drafts++;
    const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + DI, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0.7, max_tokens: 2500, response_format: { type: 'json_object' }, messages: msgs }) });
    if (!res.ok) throw new Error('DeepInfra HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160));
    const j = await res.json(); usage.in += j.usage.prompt_tokens; usage.out += j.usage.completion_tokens;
    const raw = j.choices[0].message.content.replace(/^```json|```$/g, '').trim();
    try { ideas = JSON.parse(raw).ideas; } catch (e) { ideas = null; }
    f = ideas ? faults(ideas, g) : '[FAIL] the answer was not the JSON asked for';
    if (process.env.IH_DEBUG) console.error(g.client.name + ' draft ' + drafts + ':\n' + (f || 'clean'));
    if (!f) break;
    msgs.push({ role: 'assistant', content: raw }, { role: 'user', content: 'Rewrite. These break the rules, fix them and keep the rest:\n' + f });
  }
  if (f) throw new Error(g.client.name + ' REFUSED after 3 drafts:\n' + f);
  return { ideas, drafts, usage, usd: +((usage.in * PRICE_IN + usage.out * PRICE_OUT) / 1e6).toFixed(5) };
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function sampleHtml(blocks) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:13mm}body{font:10pt/1.4 -apple-system,Inter,Helvetica,sans-serif;color:#141820}h1{font-size:18pt;margin:0}.sub{color:#5b6472;margin:2px 0 10px}
h2{font-size:13pt;margin:12px 0 2px}.meta{color:#5b6472;font-size:9pt;margin-bottom:6px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.card{border:1px solid #dde2ea;border-radius:8px;padding:8px 10px;break-inside:avoid}.fmt{font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#0a7f8f}
.t{font-weight:700;margin:2px 0 4px}.k{font-size:8.5pt;color:#5b6472;margin-top:5px}.why{font-size:8.5pt;color:#5b6472;margin-top:5px;font-style:italic}.foot{margin-top:10px;color:#8a93a1;font-size:8pt}</style></head><body>
<h1>Idea helper, sample</h1><div class="sub">Three ideas per client for the SMM to keep, change or drop. Suggestions only: the SMM decides.</div>
${blocks.map(b => `<h2>${esc(b.g.client.name)}</h2><div class="meta">Grounded in: the staff brain (${esc(b.g.brainDate || 'none')}), ${b.g.pillars.length} pillars, ${b.g.planned.length} items already planned, ${b.g.inspo.length} Inspo Hub links</div>
<div class="grid">${b.s.ideas.map(it => `<div class="card"><div class="fmt">${esc(it.format)} · ${esc(it.effort)} effort</div><div class="t">${esc(it.title)}</div>
<div><b>Hook:</b> ${esc(it.hook)}</div><div style="margin-top:3px">${esc(it.shows)}</div>
<div class="k"><b>Purpose:</b> ${esc(it.objective)}, ${esc(it.stage)} stage${it.pillar && it.pillar !== 'none' ? ', pillar ' + esc(it.pillar) : ''}</div><div class="why">${esc(it.why)}</div></div>`).join('')}</div>`).join('')}
<div class="foot">Drafted by ${MODEL.split('/')[1]} on DeepInfra from the client's own records only. Nothing was sent to a client or saved.</div></body></html>`;
}
export async function pdf(html, out) {
  const { chromium } = require(path.join(HOME, 'bb-systems/batch/node_modules/playwright'));
  const browser = await chromium.launch(); try { const page = await browser.newPage(); await page.setContent(html); await page.pdf({ path: out, format: 'A4', printBackground: true }); } finally { await browser.close(); }
  return (fs.readFileSync(out, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
}
