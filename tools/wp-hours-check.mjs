/* WEEKLY PLAN BY THE HOUR: the browser check (23 Oct 2026).
   Serves this folder's index.html at localhost WITHOUT a server (Playwright answers the requests),
   reads every table from the live database and NEVER WRITES: every POST, PATCH and DELETE is
   answered here from an in-memory copy of smm_weekly_plan. So it proves the screens and the click
   path before the three new columns exist. It can be run any day without touching real rows.
   Run:  ~/.local/node/bin/node tools/wp-hours-check.mjs [--shots DIR]
   Exit code 0 only when every check in every seat at every width is green. */
import { createRequire } from 'module';
import fs from 'fs'; import path from 'path'; import url from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.HOME, 'bb-systems/batch/node_modules/playwright'));
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
/* WP_LIVE=1 loads the real published page instead of this folder; writes are still answered in memory. */
const ORIGIN = process.env.WP_LIVE ? 'https://businessboosterlk.github.io/bb-smm-workspace' : 'http://localhost:8799';
const SB = 'https://yyviiwnqgphyklcoijyd.supabase.co';
const shotsAt = process.argv.indexOf('--shots'); const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
const pad = n => String(n).padStart(2, '0');
const monday = (() => { const d = new Date(); const g = d.getDay(); d.setDate(d.getDate() - g + (g === 0 ? -6 : 1)); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); })();

/* The fixture: a working week per seat, with one slot over lunch, one after 17:30 and rows with no time. */
let nextId = 900000;
const STORE = [];
function row(by, day, from, to, notes, extra) { STORE.push(Object.assign({ id: nextId++, week_start: monday, day_of_week: day, client_name: null, task_type: 'post', task_count: 1, notes, status: 'planned', assigned_to: by, created_by: by, starts_at: from, ends_at: to, link: null, created_at: new Date().toISOString() }, extra || {})); }
for (const by of ['Nirvana', 'Tiana', 'Hithesh']) {
  for (let d = 1; d <= 5; d++) {
    row(by, d, '08:30:00', '09:00:00', 'Morning brief to the team');
    row(by, d, '09:45:00', '12:00:00', 'Deep block: captions and approvals', { client_name: 'Sastho', link: 'https://docs.google.com/document/d/probe-' + by + d });
    row(by, d, '12:00:00', '12:45:00', 'Systems check, runs over lunch');
    row(by, d, '13:30:00', '14:30:00', 'Creative hour', { status: d < 3 ? 'done' : 'planned' });
    row(by, d, '17:00:00', '18:00:00', 'Evening check and report');
    row(by, d, null, null, 'Reply to the CCT group (no time yet)');
  }
}
const WRITES = [];
function parseQ(u) { const q = {}; for (const [k, v] of new URL(u).searchParams) q[k] = v; return q; }
function matches(r, q) {
  for (const [k, v] of Object.entries(q)) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const m = v.match(/^(eq|neq|lte|gte)\.(.*)$/); if (!m) continue;
    const a = r[k] == null ? '' : String(r[k]), b = decodeURIComponent(m[2]);
    if (m[1] === 'eq' && a !== b) return false; if (m[1] === 'neq' && a === b) return false;
    if (m[1] === 'lte' && !(+a <= +b)) return false; if (m[1] === 'gte' && !(+a >= +b)) return false;
  }
  return true;
}
async function wire(ctx) {
  if (!process.env.WP_LIVE) await ctx.route(ORIGIN + '/**', async rt => {
    let p = new URL(rt.request().url()).pathname; if (p === '/') p = '/index.html';
    if (p === '/index.html' && process.env.WP_FILE) return rt.fulfill({ status: 200, body: fs.readFileSync(process.env.WP_FILE), contentType: 'text/html' });
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return rt.fulfill({ status: 404, body: '' });
    const ext = path.extname(f); const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' }[ext] || 'application/octet-stream';
    return rt.fulfill({ status: 200, body: fs.readFileSync(f), contentType: type });
  });
  await ctx.route(SB + '/**', async rt => {
    const req = rt.request(), m = req.method(), u = req.url();
    const isPlan = u.includes('/rest/v1/smm_weekly_plan');
    if (m === 'GET' || m === 'HEAD') {
      if (isPlan) { const q = parseQ(u); let rows = STORE.filter(r => matches(r, q)); if (q.select) { const cols = q.select.split(','); rows = rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]]))); } return rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }); }
      return rt.continue();
    }
    if (m === 'OPTIONS') return rt.continue();
    const body = req.postData() || ''; WRITES.push({ m, u: u.replace(SB, ''), body: body.slice(0, 400) });
    if (isPlan) {
      const q = parseQ(u); const data = body ? JSON.parse(body) : {};
      if (m === 'PATCH') STORE.filter(r => matches(r, q)).forEach(r => Object.assign(r, data));
      if (m === 'POST') STORE.push(Object.assign({ id: nextId++, starts_at: null, ends_at: null, link: null }, data));
      if (m === 'DELETE') { for (let i = STORE.length - 1; i >= 0; i--) if (matches(STORE[i], q)) STORE.splice(i, 1); }
    }
    return rt.fulfill({ status: m === 'POST' ? 201 : 204, body: '' });
  });
}
const R = []; const ok = (name, pass, detail) => { R.push({ name, pass: !!pass, detail: String(detail ?? '') }); };
let LAST = null;
async function open(browser, view, seat) {
  const ctx = await browser.newContext(view);
  await wire(ctx);
  /* The morning check-in popup is real and freezes the page behind it, as it should. It opens on a
     four second timer, so mark today's check-in as seen before the page loads. */
  await ctx.addInitScript(() => { const d = new Date(); try { localStorage.setItem('smm-checkin-last', d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); } catch (e) {} });
  const page = await ctx.newPage(); LAST = page;
  page.on('dialog', d => d.accept());
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof smmEnterApp === 'function');
  await page.evaluate(n => smmEnterApp(n, false), seat);
  await page.waitForFunction(() => (S.clients || []).length > 0, null, { timeout: 90000 });
  await page.waitForTimeout(2500);                                   // boot finishes its own first page
  /* The morning check-in popup is real and freezes the page behind it, as it should. Close it the way a person does. */
  await page.evaluate(() => { if (window.closeCheckinPopup) closeCheckinPopup(); });
  await page.evaluate(() => nav('weeklyplan'));
  await page.waitForFunction(() => S.currentPage === 'weeklyplan' && document.querySelectorAll('#wpBoard .wp-day').length >= 5, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}
const VIEWS = {
  'phone 375': { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  'phone 320': { viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  'desk 1366': { viewport: { width: 1366, height: 900 } }
};
const browser = await chromium.launch();
try {
  /* 1 THE HARNESS, every seat at phone and desk. */
  for (const [vn, view] of Object.entries(VIEWS)) {
    for (const seat of ['NIRVANA', 'TIANA', 'HITHESH', 'THULAIB']) {
      if (vn === 'phone 320' && seat !== 'TIANA') continue;
      const { ctx, page } = await open(browser, view, seat);
      const res = await page.evaluate(async () => { window.__ST_SILENT = true; return await runSelfTest(); });
      const hours = res.results.filter(r => /^Hours:|Weekly|weeklyplan/i.test(r.name));
      const fails = res.results.filter(r => !r.pass);
      ok(`harness ${seat} ${vn}: ${res.total - res.failed} of ${res.total} green, hours checks ${hours.filter(r => r.pass).length} of ${hours.length}`,
        hours.every(r => r.pass), fails.map(f => f.name + ' [' + f.detail.slice(0, 90) + ']').join(' || ') || 'all green');
      if (SHOTS && seat !== 'THULAIB') { await page.evaluate(() => { nav('weeklyplan'); const t = document.querySelector('.wp-day[data-day="4"]'); if (t) t.scrollIntoView(); }); await page.waitForTimeout(300); await page.screenshot({ path: path.join(SHOTS, `${seat}-${vn.replace(' ', '')}.png`), fullPage: vn.startsWith('desk') }); }
      await ctx.close();
    }
  }
  /* 2 THE CLICK PATH, as Tiana at 375: add, edit, open link, Back once and twice. */
  {
    const { ctx, page } = await open(browser, VIEWS['phone 375'], 'TIANA');
    const before = STORE.length, w0 = WRITES.length;
    await page.locator('.wp-day[data-day="2"] .wp-add-inline').tap();
    await page.waitForFunction(() => document.getElementById('modal-wp-task').style.display === 'flex');
    await page.fill('#wpNotes', 'Probe: research Bio Solv reels');
    await page.selectOption('#wpFrom', '15:00'); await page.selectOption('#wpTo', '16:15');
    await page.fill('#wpLink', 'http://not-safe.example');
    await page.locator('.wp-sheet-bar .btn-primary').tap(); await page.waitForTimeout(300);
    ok('click: an http link is refused, nothing written', WRITES.length === w0 && await page.evaluate(() => document.getElementById('modal-wp-task').style.display === 'flex'), (WRITES.length - w0) + ' writes');
    await page.fill('#wpLink', 'https://docs.google.com/document/d/probe-new');
    await page.locator('.wp-sheet-bar .btn-primary').tap();
    await page.waitForFunction(() => document.getElementById('modal-wp-task').style.display !== 'flex');
    await page.waitForFunction(() => [...document.querySelectorAll('.wp-day[data-day="2"] .wp-slot')].some(e => /Probe: research/.test(e.textContent)));
    const added = STORE[STORE.length - 1];
    ok('click: add writes one row with the slot and the link', STORE.length === before + 1 && added.starts_at === '15:00' && added.ends_at === '16:15' && added.link === 'https://docs.google.com/document/d/probe-new' && added.created_by === 'Tiana', JSON.stringify({ s: added.starts_at, e: added.ends_at, l: added.link, by: added.created_by }));
    const slotTxt = await page.locator('.wp-day[data-day="2"] .wp-slot', { hasText: 'Probe: research' }).textContent();
    ok('click: the new slot reads 15:00 to 16:15, 1 h 15 min, with Open', /15:00 to 16:15, 1 h 15 min/.test(slotTxt) && /Open/.test(slotTxt), slotTxt.trim().slice(0, 90));
    /* edit: change only the end time */
    const w1 = WRITES.length;
    await page.locator('.wp-day[data-day="2"] .wp-slot', { hasText: 'Probe: research' }).locator('.wp-task-main').tap();
    await page.waitForFunction(() => document.getElementById('modal-wp-task').style.display === 'flex');
    ok('click: edit opens with the stored times and link', await page.evaluate(() => wpFrom.value === '15:00' && wpTo.value === '16:15' && wpLink.value.includes('probe-new')), await page.evaluate(() => wpFrom.value + ' ' + wpTo.value));
    await page.selectOption('#wpTo', '16:30');
    await page.locator('.wp-sheet-bar .btn-primary').tap();
    await page.waitForFunction(() => document.getElementById('modal-wp-task').style.display !== 'flex');
    const patch = WRITES.slice(w1).find(w => w.m === 'PATCH');
    const sent = patch ? Object.keys(JSON.parse(patch.body)).sort().join(',') : 'none';
    ok('click: the edit PATCHes one row by id and sends only ends_at', !!patch && /id=eq\.\d+$/.test(patch.u) && sent === 'ends_at,updated_at', sent + ' to ' + (patch && patch.u));
    /* open link: a new tab, the app stays */
    const [popup] = await Promise.all([ctx.waitForEvent('page'), page.locator('.wp-day[data-day="2"] .wp-slot', { hasText: 'Probe: research' }).locator('a.wp-open').tap()]);
    ok('click: Open goes to a new tab, the plan stays on screen', popup.url().includes('probe-new') && await page.evaluate(() => S.currentPage === 'weeklyplan'), popup.url().slice(0, 60));
    await popup.close();
    await page.bringToFront(); await page.waitForTimeout(500);
    /* Back once and twice after a sheet */
    await page.locator('.wp-day[data-day="3"] .wp-add-inline').tap();
    await page.waitForFunction(() => document.getElementById('modal-wp-task').style.display === 'flex');
    await page.goBack().catch(() => {});
    await page.waitForFunction(() => document.getElementById('modal-wp-task').style.display !== 'flex', null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);                                    // a sheet that closes itself does so after the first look
    const s1 = await page.evaluate(() => ({ sheet: document.getElementById('modal-wp-task').style.display, pg: S.currentPage, url: location.href }));
    ok('click: Back once closes the sheet and stays on the plan', s1.sheet !== 'flex' && s1.pg === 'weeklyplan', JSON.stringify(s1));
    await page.goBack().catch(() => {}); await page.waitForTimeout(800);
    const s2 = await page.evaluate(() => ({ sheet: document.getElementById('modal-wp-task').style.display, pg: (typeof S !== 'undefined' ? S.currentPage : null), url: location.href })).catch(() => ({ left: true }));
    ok('click: Back twice leaves the plan (or the app), the sheet stays shut', s2.left || s2.sheet !== 'flex', JSON.stringify(s2));
    await ctx.close();
  }
  /* 3 TWO DEVICES: a tick on the phone appears on the laptop and a stale laptop edit keeps it. */
  {
    const phone = await open(browser, VIEWS['phone 375'], 'NIRVANA');
    const desk = await open(browser, VIEWS['desk 1366'], 'NIRVANA');
    const target = STORE.find(r => r.created_by === 'Nirvana' && r.day_of_week === 4 && /Evening check/.test(r.notes));
    target.status = 'planned';
    await desk.page.evaluate(id => wpOpenEdit(id), target.id);          // the laptop opens the sheet: its copy says To do
    await phone.page.evaluate(() => wpLoadWeek());
    await phone.page.locator(`.wp-slot[data-id="${target.id}"] .wp-check`).tap();
    for (let i = 0; i < 40 && target.status !== 'done'; i++) await phone.page.waitForTimeout(100);
    ok('devices: the phone tick is stored', target.status === 'done', target.status);
    await desk.page.fill('#wpLink', 'https://docs.google.com/document/d/probe-evening');
    await desk.page.locator('.wp-sheet-bar .btn-primary').click();
    await desk.page.waitForFunction(() => document.getElementById('modal-wp-task').style.display !== 'flex');
    ok('devices: the stale laptop edit adds the link and keeps the phone tick', target.status === 'done' && target.link.includes('probe-evening'), target.status + ', ' + target.link);
    target.status = 'planned';                                           // another device unticks it
    await desk.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    const deskSees = await desk.page.waitForFunction(id => { const e = document.querySelector(`.wp-slot[data-id="${id}"]`); return e && !e.classList.contains('done'); }, target.id, { timeout: 8000 }).then(() => true, () => false);
    ok('devices: coming back on screen re-reads, the laptop shows the change', deskSees, deskSees ? 'redrawn' : 'still the old tick');
    await phone.ctx.close(); await desk.ctx.close();
  }
  /* 4 THULAIB: one seat at a time, with the proof count per seat. */
  {
    const { ctx, page } = await open(browser, VIEWS['desk 1366'], 'THULAIB');
    const chips = await page.locator('.wp-seat').allTextContents();
    ok('master: one chip per seat with its proof count', chips.length >= 3 && chips.every(c => /with proof/.test(c)), chips.join(' | '));
    await page.locator('.wp-seat', { hasText: 'Hithesh' }).click();
    const seen = await page.evaluate(() => [...new Set(wpVisibleTasks().map(t => t.created_by))].join());
    ok('master: picking Hithesh shows only Hithesh', seen === 'Hithesh', seen);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'THULAIB-desk1366.png'), fullPage: true });
    await ctx.close();
  }
} catch (e) { let st = ''; try { st = JSON.stringify(await LAST.evaluate(() => ({ body: document.body.className, open: [...document.querySelectorAll('.modal-bg, #smm-checkin-overlay, #agent-drawer-overlay, #bb-detail-overlay, .sidebar-backdrop')].filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0).map(e => e.id || e.className), stack: String(new Error().stack).slice(0, 0) }))); } catch (x) {} ok('the check ran to the end', false, String(e && e.message || e).split('\n')[0] + ' ' + st + ' at ' + String(e.stack).split('\n').find(l => l.includes('wp-hours-check'))); } finally { await browser.close(); }
const live = WRITES.filter(w => !w.u.includes('smm_weekly_plan'));
console.log('\nWEEKLY PLAN BY THE HOUR, browser check');
R.forEach(r => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + ((!r.pass || /^harness/.test(r.name)) ? '\n     ' + r.detail : '')));
console.log(`\n${R.filter(r => r.pass).length} of ${R.length} green. Writes caught and answered in memory: ${WRITES.length} (${live.length} outside the plan table, none reached the database).`);
process.exit(R.every(r => r.pass) ? 0 : 1);
