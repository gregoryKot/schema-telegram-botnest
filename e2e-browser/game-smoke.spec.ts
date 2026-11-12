// Смок игры `game/` (issue #1088): игра вне юнит-гейтов, поломку сцены видел
// только человек. Прод-сборка в Chromium: вход по хешу в каждую сцену,
// смерть → чекпоинт, финал гл.4 с подписанной кнопкой и кризисной строкой.
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';

// Игра анонимна; /api/public-event отвечает стаб формы сервера, падение рантайма роняет тест.
test.use({ session: 'anonymous', locale: 'ru-RU' });

const HOTLINE = '8-800-100-49-94';

/** То, что смок трогает в GameScene (поля приватные — доступ только из браузера). */
interface Obj {
  type: string;
  text?: string;
  x: number;
  y: number;
  depth: number;
  input?: unknown;
}
interface GameSceneLike {
  dead: boolean;
  player: { x: number; y: number; body: { reset(x: number, y: number): void } };
  gameOver(): void;
  time: { timeScale: number };
  tweens: { timeScale: number };
  children: { list: Obj[] };
}
interface GameWindow {
  __game?: {
    scene: { isActive(k: string): boolean; getScene(k: string): unknown };
  };
  __gs?: () => GameSceneLike;
  ym?: () => void;
}

let events: string[] = [];

test.beforeEach(async ({ page }) => {
  events = [];
  page.on('request', (req) => {
    if (req.method() !== 'POST') return;
    if (new URL(req.url()).pathname !== '/api/public-event') return;
    const body = req.postDataJSON() as { name?: string } | null;
    if (body?.name) events.push(body.name);
  });
  // Метрика глушится; `__gs` — короткий доступ к сцене Game из page.evaluate.
  await page.addInitScript(() => {
    const w = window as unknown as GameWindow;
    w.ym = () => {};
    w.__gs = () => w.__game!.scene.getScene('Game') as GameSceneLike;
  });
  // Чужие хосты (шрифты, Метрика) — не в смоке: только наш сервер.
  await page.route(
    (url) => url.hostname !== '127.0.0.1',
    (r) => r.abort(),
  );
});

/** Хеш-переход не перезагружает страницу — каждый заход с чистого листа; ждём сцену, а не время. */
async function openGame(page: Page, hash: string, scene: string) {
  await page.goto('about:blank');
  await page.goto(`/game/#${hash}`);
  await page.waitForFunction(
    (k) => !!(window as unknown as GameWindow).__game?.scene.isActive(k),
    scene,
    {
      timeout: 30_000,
    },
  );
}

const sceneTexts = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as GameWindow).__gs!()
      .children.list.filter((o) => o.type === 'Text')
      .map((o) => o.text ?? ''),
  );

const SCENES = [
  { hash: 'intro', scene: 'Intro' },
  { hash: 'tutorial', scene: 'Tutorial' },
  { hash: 'chapter1', scene: 'Game' },
  { hash: 'chapter2', scene: 'Game' },
  { hash: 'chapter3', scene: 'Game' },
  { hash: 'chapter4', scene: 'Game' },
];

test.describe('игра: смок прод-сборки', () => {
  for (const s of SCENES) {
    test(`#${s.hash} открывает сцену ${s.scene}`, async ({ page }) => {
      await openGame(page, s.hash, s.scene);
      await expect.poll(() => events).toContain('game_open');
      if (s.scene === 'Game')
        await expect.poll(() => events).toContain('game_chapter_start');
    });
  }

  test('гл.1: смерть возвращает на чекпоинт, а не в начало', async ({
    page,
  }) => {
    await openGame(page, 'chapter1', 'Game');
    // Кот у x≈4300 (за чекпоинтом 4000) — и смерть.
    await page.evaluate(() => {
      const sc = (window as unknown as GameWindow).__gs!();
      sc.player.body.reset(4300, sc.player.y);
      sc.gameOver();
    });
    // «Любая клавиша» вешается через ~1.9с игрового времени — жмём, пока кот не вернётся.
    const respawnX = async () => {
      await page.keyboard.press('Space');
      return page.evaluate(() => {
        const sc = (window as unknown as GameWindow).__gs!();
        return sc.dead ? null : sc.player.x;
      });
    };
    await expect
      .poll(respawnX, { timeout: 30_000, intervals: [500] })
      .not.toBeNull();
    const x = await respawnX();
    expect(x).toBeGreaterThan(3950);
    expect(x).toBeLessThan(4100);
  });

  test('гл.4: после «ВСТРЕТИТЬ» — кнопка с подписью и кризисная строка', async ({
    page,
  }) => {
    await openGame(page, 'chapter4', 'Game');
    // Сеанс идёт ~25с игрового времени — ускоряем часы и твины сцены.
    await page.evaluate(() => {
      const sc = (window as unknown as GameWindow).__gs!();
      sc.time.timeScale = 5;
      sc.tweens.timeScale = 5;
    });
    const has = async (s: string) =>
      (await sceneTexts(page)).some((t) => t.includes(s));
    await expect.poll(() => has('ВСТРЕТИТЬ'), { timeout: 30_000 }).toBe(true);
    // Слушатель вешается через 1.4с после подсказки — жмём E с удержанием, пока подсказка не уйдёт.
    const meet = async () => {
      await page.keyboard.down('KeyE');
      await page.waitForTimeout(150);
      await page.keyboard.up('KeyE');
      return has('ВСТРЕТИТЬ');
    };
    await expect.poll(meet, { timeout: 30_000, intervals: [300] }).toBe(false);
    await expect.poll(() => has(HOTLINE), { timeout: 30_000 }).toBe(true);
    // Кнопки финала (запись, поделиться): у каждой заливки поверх — непустая подпись.
    const buttons = await page.evaluate(() => {
      const list = (window as unknown as GameWindow).__gs!().children.list;
      const near = (a: Obj, b: Obj) =>
        Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
      const labelled = (b: Obj) =>
        list.some(
          (o) =>
            o.type === 'Text' &&
            !!o.text?.trim() &&
            near(o, b) &&
            o.depth > b.depth,
        );
      const rects = list.filter((b) => b.type === 'Rectangle' && b.input);
      return {
        total: rects.length,
        unlabelled: rects.filter((b) => !labelled(b)).length,
      };
    });
    expect(buttons.total).toBeGreaterThanOrEqual(2);
    expect(buttons.unlabelled, 'кнопка финала без подписи').toBe(0);
  });
});
