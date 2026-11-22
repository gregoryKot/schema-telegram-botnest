#!/usr/bin/env node
// Использование: node shoot.mjs <каталог-репо> <outDir> [--skip-build]
// Собирает webapp (vite build), поднимает vite preview, снимает кадры справочника и «По фазам» со стабом API.
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [repo, outDir, ...flags] = process.argv.slice(2);
if (!repo || !outDir) { console.error('usage: shoot.mjs <repo> <outDir> [--skip-build]'); process.exit(2); }
const web = path.join(path.resolve(repo), 'webapp');
fs.mkdirSync(outDir, { recursive: true });

const env = { ...process.env, VITE_BOT_USERNAME: process.env.VITE_BOT_USERNAME || 'ShotsBot' };
if (!flags.includes('--skip-build') || !fs.existsSync(path.join(web, 'dist/index.html'))) {
  console.log('vite build…');
  execFileSync('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: web, env, stdio: 'inherit' });
}

const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: web, env, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch { /* ждём */ } await new Promise((r) => setTimeout(r, 500)); }

// ─── Фикстуры ───
const CLIENT_ID = '7001';
const CODE = 'abcdefgh';
const client = {
  telegramId: CLIENT_ID, urlCode: CODE, name: 'Анна', clientAlias: null, streak: 4, lastActiveDate: '2026-11-21',
  daysSinceActive: 1, todayIndex: 62, recentIndexHistory: [62, 55, 60, null, 58, 50, 47, 52, 49, 55, 60, 61, 58, 57],
  relationCreatedAt: '2026-09-01T10:00:00.000Z', therapyStartDate: '2026-09-02', nextSession: null, meetingDays: [2], schemaIds: [],
};
const ph = (id, position, name, goal, weeks, tpl, over = {}) => ({
  id, position, name, goal, weeks, templatePhaseId: tpl, startedAt: null, endedAt: null, criteriaDone: [], note: null, ...over,
});
const therapyPath = {
  id: 1, clientId: CLIENT_ID, startDate: '2026-09-07', templateId: 'general', createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z',
  phases: [
    ph(11, 0, 'Оценка и концептуализация', 'Понять схемы и режимы клиента', 6, 'assessment', { startedAt: '2026-09-07', endedAt: '2026-10-19', criteriaDone: [0, 1] }),
    ph(12, 1, 'Установление связи и осознание', 'Научиться замечать режимы в моменте', 10, 'bonding', { startedAt: '2026-10-19' }),
    ph(13, 2, 'Изменение: работа со схемами и режимами', 'Ослабить Карающего Критика', 20, 'change'),
    ph(14, 3, 'Автономия', 'Опора на Здорового Взрослого', 8, 'autonomy'),
    ph(15, 4, 'Завершение', null, 4, 'ending'),
  ],
};
const item = (id, rubric, text, status, phaseId, position) => ({
  id, clientId: CLIENT_ID, rubric, text, status, position, sourceAddress: null, source: null, taskId: null, phaseId,
  createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
});
const planItems = [
  item(1, 'cognitive', 'Дневник схем: отслеживать срабатывания', 'done', 11, 0),
  item(2, 'relationship', 'Обсудить на сессии ощущение безопасности в контакте', 'done', 11, 1),
  item(3, 'experiential', 'Образ-безопасное место', 'active', 12, 2),
  item(4, 'cognitive', 'Карточка-напоминание для Уязвимого Ребёнка', 'active', 12, 3),
  item(5, 'behavioral', 'Эксперимент: попросить о помощи коллегу', 'planned', 13, 4),
  item(6, 'experiential', 'Работа с образами и переписывание сценария про Карающего Критика на сессии', 'planned', 13, 5),
  item(7, 'session', 'Диалог стульев с Карающим Критиком', 'planned', 13, 6),
  item(8, 'between', 'Практика заботы о себе раз в день', 'planned', 14, 7),
  item(9, 'custom', 'Подготовить письмо на прощание', 'planned', 15, 8),
  item(10, 'custom', 'Пункт вне фаз: прочитать главу про режимы', 'planned', null, 9),
];
const profile = {
  name: 'Мария', role: 'THERAPIST', ysq: { completedAt: null, activeSchemaIds: [] },
  notifications: { enabled: false, reminderEnabled: false, timezone: 'Europe/Moscow', localHour: 20 },
  streak: 0, lastActivity: { needsTracker: null, schemaDiary: null, modeDiary: null, gratitudeDiary: null }, mySchemaIds: [], myModeIds: [],
};

const unknown = new Map();
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
async function stubApi(page) {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const m = req.method();
    if (p === '/api/auth/refresh') return json(route, { accessToken: 'shot-token', expiresIn: 3600 });
    if (p === '/api/profile') return json(route, profile);
    if (p === '/api/settings') return json(route, { notifyEnabled: false, notifyLocalHour: 20, notifyTimezone: 'Europe/Moscow', notifyReminderEnabled: false, addressForm: 'ty', pairCardDismissed: true, mySchemaIds: [], myModeIds: [], therapistShareCards: false, therapistShareProfile: false, uiPrefs: null });
    if (p === '/api/disclaimer') return json(route, { accepted: true });
    if (p === '/api/user-flags') return json(route, { therapistMode: true });
    if (p === '/api/therapy/clients') return json(route, [client]);
    if (p === `/api/therapy/plan/${CLIENT_ID}`) return json(route, planItems);
    if (p === `/api/therapy/path/${CLIENT_ID}`) return json(route, { path: therapyPath });
    if (m === 'POST' && /\/(analytics|errors|client-error)/.test(p)) return json(route, {});
    const key = `${m} ${p}`;
    unknown.set(key, (unknown.get(key) ?? 0) + 1);
    return json(route, m === 'GET' && !/(\/me|\/detail|\/settings|\/flags|\/status)$/.test(p) ? [] : {});
  });
}

const SIZES = [{ w: 1280, h: 800 }, { w: 390, h: 844 }];
const TABS = [['modes', 'Режимы'], ['schemas', 'Схемы'], ['needs', 'Потребности'], ['techniques', 'Техники'], ['concerns', 'Запросы'], ['path', 'Путь терапии'], ['practice', 'Для терапевта']];
const done = []; const failed = [];

const browser = await chromium.launch();
try {
  for (const { w, h } of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: 'light', locale: 'ru-RU' });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('app_theme', 'light'); localStorage.setItem('therapist_privacy_disclaimer_seen', '1'); 
        localStorage.setItem('cookie_consent', 'all');
      } catch { /* нет хранилища */ }
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[pageerror ${w}]`, String(e).slice(0, 200)));
    await stubApi(page);
    const snap = async (name) => {
      const file = path.join(outDir, `${name}-${w}.png`);
      // прокручивается внутренний контейнер, не окно: растим вьюпорт до высоты содержимого, затем возвращаем
      const extra = await page.evaluate(() => {
        let best = 0;
        for (const el of document.querySelectorAll('*')) {
          const o = getComputedStyle(el).overflowY;
          if ((o === 'auto' || o === 'scroll') && el.scrollHeight - el.clientHeight > best) best = el.scrollHeight - el.clientHeight;
        }
        return best;
      });
      if (process.env.DBG) console.log(name, w, extra, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 200).map(e => e.tagName + '.' + e.className + ' ' + getComputedStyle(e).overflowY + ' ' + e.scrollHeight + '/' + e.clientHeight).slice(0, 6))));
      await page.setViewportSize({ width: w, height: Math.min(h + extra + 8, 6000) });
      await page.waitForTimeout(400);
      await page.screenshot({ path: file, fullPage: true });
      await page.setViewportSize({ width: w, height: h });
      done.push(path.basename(file));
    };

    // ── справочник ──
    await page.goto(`${base}/cabinet/guide`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    await page.getByRole('tab', { name: 'Режимы' }).waitFor({ timeout: 20000 }).catch(() => {});
    for (const [id, label] of TABS) {
      try {
        const tab = page.getByRole('tab', { name: label, exact: true });
        await tab.click({ timeout: 8000 });
        await page.waitForTimeout(600);
        // раскрыть все свёрнутые группы
        for (let i = 0; i < 20; i++) {
          const closed = page.locator('.gr-list [aria-expanded="false"]');
          if (!(await closed.count())) break;
          await closed.first().click(); await page.waitForTimeout(150);
        }
        await page.mouse.move(0, 0);
        await snap(id);
      } catch (e) { failed.push(`${id}-${w}: ${String(e).split('\n')[0]}`); }
    }

    // ── «По фазам» ──
    try {
      await page.goto(`${base}/cabinet/${CODE}/plan?layout=phases`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
      await page.locator('h2, h3', { hasText: 'Оценка и концептуализация' }).first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(800);
      await snap('phases');
      const menuBtn = page.getByRole('button', { name: /Перенести пункт в фазу/ }).nth(2);
      await menuBtn.scrollIntoViewIfNeeded().catch(() => {});
      await menuBtn.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await snap('phases-menu');
    } catch (e) {
      failed.push(`phases-${w}: ${String(e).split('\n')[0]}`);
      await page.screenshot({ path: path.join(outDir, `_debug-phases-${w}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  preview.kill();
}
console.log('unknown API routes:', JSON.stringify([...unknown], null, 0));
console.log('done:', done.join(' '));
if (failed.length) console.log('FAILED:', failed.join(' | '));
