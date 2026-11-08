/* Pass marks for the From Thulaib card in the BB SMM Workspace (THULAIB CC HANDOFF, 8 Nov 2026).
   Adapted from the Command Centre's handoff/parts/handoff.check.mjs. Opens the real index.html signed in as NIRVANA
   on a 390 px phone and a 1440 px desk with every Supabase call answered by test data (nothing reaches the database).
   Checks the pasted parts are byte for byte, the card's place on Today, Done (optional line), Stuck (a reason is
   required) and Carry on with their exact bodies, no card with no tasks, no page errors and the rest of Today intact.
   python3 -m http.server 8794 --bind 127.0.0.1 &   then   node handoff-from-card.check.mjs [base-url] */
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:8794/index.html';
const PARTS = '/Users/thulaibhassen/bb-command-centre/.claude/worktrees/vigilant-cannon-efb76a/handoff/parts/';
const rows = []; let bad = 0, total = 0;
const pass = (name, ok, note = '') => { total++; if (!ok) bad++; rows.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  (' + note + ')' : ''}`); };

/* parity: the card and its CSS are the Command Centre's parts, unchanged */
{
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const a = html.indexOf('<!-- @@BBHO_FROM_CARD@@ BEGIN'), z = html.indexOf('<!-- @@BBHO_FROM_CARD@@ END -->');
  const block = a >= 0 && z > a ? html.slice(a, z) : '';
  pass('one From card block between the markers', a >= 0 && z > a && html.split('@@BBHO_FROM_CARD@@ BEGIN').length === 2);
  pass('h5-card.js pasted byte for byte', block.includes(readFileSync(PARTS + 'h5-card.js', 'utf8')));
  pass('ho.css pasted byte for byte', block.includes(readFileSync(PARTS + 'ho.css', 'utf8')));
  const glue = block.slice(block.indexOf('/* glue: SMM Workspace ('));
  pass('the glue is small (under 60 lines)', glue.split('\n').length < 60, glue.split('\n').length + ' lines');
}

const TEAM = [{ id: 12 }];
const CLIENTS = [{ id: 41, name: 'SASTHO', status: 'active' }, { id: 42, name: 'SUN ZAPPER', status: 'active' }, { id: 43, name: 'WAVERLEY', status: 'active' }];
/* tasks sent TO Nirvana: one fresh from Thulaib, one late from Shiara, one stuck with Thulaib's reply, one done today */
const CARD = [
  { id: 901, title: 'Post the Waverley carousel', due: '2026-11-20', client_id: 43, notes: 'Use the October photos', sent_by: 'THULAIB', seen_at: null, stuck_note: null, stuck_at: null, stuck_reply: null, stuck_reply_at: null, done: false, done_note: null, completed_at: null, created_at: '2026-11-08T03:00:00Z' },
  { id: 902, title: 'Reply to the Sastho comments', due: '2026-11-02', client_id: 41, notes: null, sent_by: 'SHIARA', seen_at: '2026-11-07T03:00:00Z', stuck_note: null, stuck_at: null, stuck_reply: null, stuck_reply_at: null, done: false, done_note: null, completed_at: null, created_at: '2026-11-07T03:00:00Z' },
  { id: 903, title: 'Plan the Sun Zapper week', due: null, client_id: 42, notes: null, sent_by: 'THULAIB', seen_at: '2026-11-07T03:00:00Z', stuck_note: '07 Nov 10:15 Waiting on the client brief', stuck_at: '2026-11-07T04:45:00Z', stuck_reply: 'Plan it from last month, the brief comes Monday', stuck_reply_at: '2026-11-07T05:00:00Z', done: false, done_note: null, completed_at: null, created_at: '2026-11-06T03:00:00Z' },
  { id: 904, title: 'Send the Waverley report', due: null, client_id: 43, notes: null, sent_by: 'SHIARA', seen_at: '2026-11-08T03:00:00Z', stuck_note: null, stuck_at: null, stuck_reply: null, stuck_reply_at: null, done: true, done_note: 'Sent on WhatsApp', completed_at: '2026-11-08T05:00:00Z', created_at: '2026-11-05T03:00:00Z' }
];

const SEAT_ID = { THULAIB: 23, SHIARA: 24, NIRVANA: 12, TIANA: 22, HITHESH: 29 };
async function page(b, opts, cardRows, seat = 'NIRVANA') {
  const ctx = await b.newContext({ ...opts, colorScheme: 'dark' });
  await ctx.addInitScript((s) => { sessionStorage.setItem('smm-seat', s); }, seat);
  const calls = [], writes = [], taskReads = [];
  await ctx.route(/supabase\.co\//, async (route) => {
    const req = route.request(), u = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.pathname.startsWith('/auth/v1/')) return json({});
    if (u.pathname.startsWith('/rest/v1/rpc/bb_handoff_')) {
      const name = u.pathname.split('/').pop(); calls.push({ name, body: JSON.parse(req.postData() || '{}') });
      return json({ ok: true });
    }
    if (req.method() !== 'GET' && req.method() !== 'HEAD') writes.push(req.method() + ' ' + u.pathname);
    if (u.pathname === '/rest/v1/team_members' && u.search.includes('select=id&')) { const n = (u.search.match(/name=eq\.([A-Z]+)/) || [])[1]; return json(SEAT_ID[n] ? [{ id: SEAT_ID[n] }] : []); }
    if (u.pathname === '/rest/v1/clients') return json(CLIENTS);
    if (u.pathname === '/rest/v1/tasks' && u.search.includes('sent_to_id=')) { taskReads.push(u.search); return json(u.search.includes('sent_to_id=eq.12&') ? cardRows : []); }
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(null);
    return json([]);
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction((s) => typeof S === 'object' && S.currentUser === s, seat, { timeout: 15000 }).catch(() => {});
  await p.waitForSelector('#ho-card-mount', { state: 'attached', timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1500);
  return { ctx, p, calls, errs, writes, taskReads };
}

const b = await chromium.launch();
for (const [size, opts] of [['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }], ['desk', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }]]) {
  const L = size;
  const { ctx, p, calls, errs, writes, taskReads } = await page(b, opts, CARD);
  pass(`${L} Nirvana's card reads only tasks sent to Nirvana`, taskReads.length >= 1 && taskReads.every(q => q.includes('sent_to_id=eq.12&')), taskReads.length + ' reads');
  pass(`${L} signed in as Nirvana from the saved seat`, await p.evaluate(() => S.currentUser) === 'NIRVANA');
  const card = p.locator('#ho-card-mount .ho-card');
  pass(`${L} card shows`, await p.locator('#ho-card-mount:not([hidden]) .ho-card').count() === 1);
  const place = await p.evaluate(() => { const m = document.getElementById('ho-card-mount'); const r = m && m.getBoundingClientRect();
    return { after: !!(m && m.previousElementSibling && m.previousElementSibling.matches('#page-today .ph')), top: r ? Math.round(r.top) : -1, w: r ? Math.round(r.width) : 0, pw: Math.round(document.querySelector('#page-today .ph').getBoundingClientRect().width) }; });
  pass(`${L} card sits right under the Today header`, place.after, JSON.stringify(place));
  pass(`${L} card starts on the first screen`, place.top >= 0 && place.top < (size === 'phone' ? 844 : 900) * 0.5, place.top + 'px');
  pass(`${L} card is as wide as the header`, Math.abs(place.w - place.pw) <= 1, place.w + ' of ' + place.pw);
  pass(`${L} card title reads From Thulaib and Shiara`, (await card.locator('.ho-card-title').textContent().catch(() => '')) === 'From Thulaib and Shiara');
  pass(`${L} card says 3 to do`, (await card.locator('.ho-card-sub').textContent().catch(() => '')) === '3 to do');
  pass(`${L} rows in order, done last`, (await card.locator('.ho-t-title').allTextContents()).join('|') === 'Post the Waverley carousel|Reply to the Sastho comments|Plan the Sun Zapper week|Send the Waverley report');
  pass(`${L} fresh row names the sender, client and day`, (await card.locator('.ho-task[data-id="901"] .ho-t-meta').textContent().catch(() => '')) === 'From Thulaib · WAVERLEY · by Fri 20 Nov', await card.locator('.ho-task[data-id="901"] .ho-t-meta').textContent().catch(() => ''));
  pass(`${L} late row says was due`, (await card.locator('.ho-task[data-id="902"] .ho-late').textContent().catch(() => '')) === 'was due Mon 2 Nov');
  pass(`${L} done row shows the what I did line`, (await card.locator('.ho-task[data-id="904"] .ho-t-meta').textContent().catch(() => '')) === 'Done · Sent on WhatsApp');
  const seen = calls.filter(c => c.name === 'bb_handoff_seen' && c.body.p_carry_on === false);
  pass(`${L} the unseen row is marked seen as Nirvana`, seen.length >= 1 && seen.every(c => c.body.p_id === 901 && c.body.p_who === 'NIRVANA'), JSON.stringify(seen.map(c => c.body)));
  /* Done with the optional line */
  let k = calls.length;
  await card.locator('.ho-task[data-id="901"] button:has-text("Done")').click(); await p.waitForTimeout(150);
  const inp = card.locator('.ho-task[data-id="901"] .ho-t-form .ho-in');
  const fs = await inp.evaluate(x => parseFloat(getComputedStyle(x).fontSize)).catch(() => 0);
  pass(`${L} Done opens a What I did line at 16px`, fs >= 16 && (await inp.getAttribute('placeholder')) === 'What I did (optional)', fs + 'px');
  await inp.fill('Posted at 6pm');
  await card.locator('.ho-task[data-id="901"] button:has-text("Mark done")').click(); await p.waitForTimeout(600);
  let c = calls.slice(k).find(x => x.name === 'bb_handoff_done');
  pass(`${L} Mark done calls bb_handoff_done { p_id 901, p_who NIRVANA, p_note }`, c && c.body.p_id === 901 && c.body.p_who === 'NIRVANA' && c.body.p_note === 'Posted at 6pm', JSON.stringify(c && c.body));
  /* Done with nothing typed sends null */
  k = calls.length;
  await card.locator('.ho-task[data-id="902"] button:has-text("Done")').click(); await card.locator('.ho-task[data-id="902"] button:has-text("Mark done")').click(); await p.waitForTimeout(600);
  c = calls.slice(k).find(x => x.name === 'bb_handoff_done');
  pass(`${L} Mark done with no line sends p_note null`, c && c.body.p_id === 902 && c.body.p_note === null, JSON.stringify(c && c.body));
  /* Stuck needs a reason */
  k = calls.length;
  await card.locator('.ho-task[data-id="902"] button:has-text("Stuck")').click(); await card.locator('.ho-task[data-id="902"] .ho-t-form button:has-text("Send")').click(); await p.waitForTimeout(200);
  pass(`${L} Stuck with nothing typed asks why and calls nothing`, calls.slice(k).length === 0 && (await card.locator('.ho-task[data-id="902"] .ho-err').textContent()) === 'Say what is in the way first.');
  await card.locator('.ho-task[data-id="902"] .ho-t-form .ho-in').fill('The client has not sent the answers');
  await card.locator('.ho-task[data-id="902"] .ho-t-form button:has-text("Send")').click(); await p.waitForTimeout(600);
  c = calls.slice(k).find(x => x.name === 'bb_handoff_stuck');
  pass(`${L} Stuck calls bb_handoff_stuck { p_id 902, p_who NIRVANA, p_note }`, c && c.body.p_id === 902 && c.body.p_who === 'NIRVANA' && c.body.p_note === 'The client has not sent the answers', JSON.stringify(c && c.body));
  /* Carry on after a reply */
  pass(`${L} the stuck row shows the reply`, (await card.locator('.ho-task[data-id="903"] .ho-t-reply').textContent().catch(() => '')) === 'Thulaib: Plan it from last month, the brief comes Monday');
  pass(`${L} Carry on shows only on the row with a reply`, await card.locator('button:has-text("Carry on")').count() === 1 && await card.locator('.ho-task[data-id="903"] button:has-text("Carry on")').count() === 1);
  k = calls.length;
  await card.locator('.ho-task[data-id="903"] button:has-text("Carry on")').click(); await p.waitForTimeout(600);
  c = calls.slice(k).find(x => x.name === 'bb_handoff_seen');
  pass(`${L} Carry on calls bb_handoff_seen { p_id 903, p_who NIRVANA, p_carry_on true }`, c && c.body.p_id === 903 && c.body.p_who === 'NIRVANA' && c.body.p_carry_on === true, JSON.stringify(c && c.body));
  const small = await p.evaluate(() => [...document.querySelectorAll('#ho-card-mount button')].filter(x => x.offsetParent && x.getBoundingClientRect().height < 43.5).map(x => x.textContent + ' ' + Math.round(x.getBoundingClientRect().height)));
  pass(`${L} every card button is 44px tall`, small.length === 0, small.join(','));
  const pair = await p.evaluate(() => { const b = [...document.querySelectorAll('.ho-task[data-id="901"] .ho-pair > button')].map(x => Math.round(x.getBoundingClientRect().width)); return b; });
  pass(`${L} Done and Stuck share the row equally`, pair.length === 2 && Math.abs(pair[0] - pair[1]) <= 1, pair.join('/'));
  /* nothing else on the first screen broke */
  const today = await p.evaluate(() => ({ active: document.getElementById('page-today').classList.contains('active'),
    meals: !!document.getElementById('meals-strip'), hero: !!document.querySelector('#page-today .today-hero') && document.querySelector('#page-today .today-hero').offsetHeight > 0,
    greet: (document.getElementById('today-greeting') || {}).textContent || '', firstChild: document.querySelector('#page-today').firstElementChild.className,
    order: [...document.querySelector('#page-today').children].slice(0, 3).map(x => x.id || x.className).join(',') }));
  pass(`${L} Today still opens first with its header, meals strip and hero`, today.active && today.meals && today.hero && today.firstChild === 'ph' && today.order === 'ph,ho-card-mount,meals-strip', JSON.stringify(today));
  const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  pass(`${L} page never scrolls sideways`, over <= 0, over + 'px');
  const sc = await p.evaluate(() => window.BBHO ? BBHO.selfcheck() : null);
  pass(`${L} BBHO.selfcheck all pass`, sc && sc.length === 4 && sc.every(x => x.pass), JSON.stringify(sc && sc.filter(x => !x.pass)));
  const inTest = await p.evaluate(() => /BBHO\.selfcheck\(\)/.test(String(window.runSelfTest)));
  pass(`${L} runSelfTest calls the card's selfcheck`, inTest);
  pass(`${L} no page or console errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
  pass(`${L} the card writes only through bb_handoff_*`, calls.every(x => /^bb_handoff_(seen|done|stuck)$/.test(x.name)), calls.map(x => x.name).join(','));
  await p.screenshot({ path: `/private/tmp/claude-501/-Users-thulaibhassen-bb-command-centre--claude-worktrees-vigilant-cannon-efb76a/51ff8c77-f434-488b-840b-24afbe57c7b8/scratchpad/smm-from-${size}.png`, fullPage: false });
  await ctx.close();

  /* no tasks means no card at all */
  {
    const { ctx, p, errs, calls } = await page(b, opts, []);
    const st = await p.evaluate(() => { const m = document.getElementById('ho-card-mount'); return { there: !!m, hidden: m ? m.hidden : null, h: m ? m.offsetHeight : 0, inner: m ? m.innerHTML.length : 0 }; });
    pass(`${L} no tasks: the card shows nothing at all`, st.there && st.hidden === true && st.h === 0 && st.inner === 0, JSON.stringify(st));
    pass(`${L} no tasks: nothing is written`, calls.length === 0, calls.map(x => x.name).join(','));
    pass(`${L} no tasks: no page or console errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  /* Thulaib, bb_pending 1595: the card shows ONLY to the person the task is for. Nirvana has four tasks; every other
     seat (Thulaib and Shiara included) sees no card and never reads a task sent to someone else. */
  for (const seat of ['THULAIB', 'SHIARA', 'TIANA', 'HITHESH']) {
    const { ctx, p, errs, calls, taskReads } = await page(b, opts, CARD, seat);
    const st = await p.evaluate(() => { const m = document.getElementById('ho-card-mount'); return { who: S.currentUser, shown: !!(m && !m.hidden && m.offsetHeight), tasks: m ? m.querySelectorAll('.ho-task').length : 0 }; });
    const own = 'sent_to_id=eq.' + SEAT_ID[seat] + '&';
    pass(`${L} ${seat}: signed in, no card while the tasks are Nirvana's`, st.who === seat && !st.shown && st.tasks === 0, JSON.stringify(st));
    pass(`${L} ${seat}: reads only tasks sent to ${seat}`, taskReads.length >= 1 && taskReads.every(q => q.includes(own)), taskReads.map(q => (q.match(/sent_to_id=eq\.\d+/) || [''])[0]).join(','));
    pass(`${L} ${seat}: nothing written, no errors`, calls.length === 0 && errs.length === 0, calls.map(x => x.name).concat(errs).join(' | ').slice(0, 200));
    await ctx.close();
  }
}
await b.close();
console.log(rows.join('\n'));
console.log(`\nRESULT: ${total - bad} of ${total} PASS${bad ? ', ' + bad + ' FAIL' : ''}`);
process.exit(bad ? 1 : 0);
