// Смок игры `game/` (issue #1088): игра вне юнит-гейтов, поломку сцены видел
// только человек. Прод-сборка в Chromium: вход в «Неделю», её каркас и тач-кнопки.
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';

// Игра анонимна; /api/public-event отвечает стаб формы сервера, падение рантайма роняет тест.
test.use({ session: 'anonymous', locale: 'ru-RU' });

interface Obj {
  type: string;
  text?: string;
  list?: Obj[];
}
interface GameWindow {
  __game?: {
    scene: { isActive(k: string): boolean; getScene(k: string): unknown };
  };
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
  // Метрика глушится.
  await page.addInitScript(() => {
    (window as unknown as GameWindow).ym = () => {};
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

test.describe('игра: смок прод-сборки', () => {
  test('#week открывает сцену Week', async ({ page }) => {
    await openGame(page, 'week', 'Week');
    await expect.poll(() => events).toContain('game_open');
  });
});

// Портрета нет (#1087, решение 5): экран «поверни телефон», сцены стоят; в альбомной — снова идут.
test.describe('игра: телефон в портрете', () => {
  test.use({
    viewport: { width: 360, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  test('поверх — «поверни телефон», цикл спит; в альбомной игра идёт', async ({
    page,
  }) => {
    await page.goto('/game/#week');
    await expect(page.locator('#rotate-hint')).toBeVisible();
    const running = () =>
      page.evaluate(
        () =>
          (window as unknown as { __game?: { loop: { running: boolean } } })
            .__game?.loop.running,
      );
    await expect.poll(running, { timeout: 30_000 }).toBe(false);
    await page.setViewportSize({ width: 800, height: 360 });
    await expect(page.locator('#rotate-hint')).toBeHidden();
    // ScaleManager во сне пропускает resize — без refresh() кадр оставался 360×200
    const canvasW = () =>
      page.evaluate(() =>
        Math.round(
          document.querySelector('canvas')!.getBoundingClientRect().width,
        ),
      );
    await expect.poll(canvasW, { timeout: 10_000 }).toBe(640);
    await page.waitForFunction(
      () => !!(window as unknown as GameWindow).__game?.scene.isActive('Week'),
      null,
      { timeout: 30_000 },
    );
  });
});

// «Неделя»: «Понедельник» с артом хука, вход по скрытому хешу #week. Саша бежит сам.
interface WeekGate {
  x: number;
  kind: string;
  open: boolean;
}
interface WeekSceneLike {
  st: {
    energy: number;
    piles: number;
    clockMin: number;
    color: number;
    load: number;
    named: boolean;
  };
  ps: { open: boolean };
  done: boolean;
  started: boolean;
  busy: boolean;
  peak: boolean;
  revealed: Set<string>;
  player: { x: number; y: number; body: { reset(x: number, y: number): void } };
  world: { gates: WeekGate[]; door: { x: number } };
  children: { list: Obj[] };
  textures: { exists(key: string): boolean };
  sasha: { texture: { key: string } };
}
const weekState = (page: Page) =>
  page.evaluate(() => {
    const sc = (window as unknown as GameWindow).__game!.scene.getScene(
      'Week',
    ) as WeekSceneLike;
    return {
      ...sc.st,
      x: sc.player.x,
      doorAhead: sc.world.door.x - sc.player.x,
      open: sc.ps.open,
      peak: sc.peak,
      busy: sc.busy,
      done: sc.done,
      started: sc.started,
      revealed: [...sc.revealed],
      gates: sc.world.gates.map((g) => ({ x: g.x, open: g.open })),
      gateCount: sc.world.gates.length,
      art: [
        'bg_wk_home',
        'bg_wk_street',
        'bg_wk_office',
        'bg_wk_office_glitch',
        'bg_wk_corridor',
        'bg_wk_boss_room',
        'wk_piles',
      ].every((k) => sc.textures.exists(k)),
      sashaSheet: sc.sasha.texture.key,
      // подписи пузырей и кнопок лежат внутри контейнеров
      texts: sc.children.list
        .flatMap((o) => [o, ...(o.list ?? [])])
        .filter((o) => o.type === 'Text')
        .map((o) => o.text ?? ''),
    };
  });
/** Саша — к точке x; место главы срабатывает, когда сцена увидит его там. */
const weekGoTo = async (page: Page, x: number, act?: string) => {
  await page.evaluate((to) => {
    const sc = (window as unknown as GameWindow).__game!.scene.getScene(
      'Week',
    ) as WeekSceneLike;
    sc.player.body.reset(to, sc.player.y);
  }, x);
  // сцена увидела Сашу на новом месте: дальше он бежит сам
  await expect
    .poll(async () => (await weekState(page)).x, { timeout: 15_000 })
    .toBeGreaterThan(x);
  if (act)
    await expect
      .poll(async () => (await weekState(page)).revealed, { timeout: 15_000 })
      .toContain(act);
};
/** Заставка слушает ввод через 250 мс; старт — пробел или касание кадра, пока сцена не скажет `started`. */
const startWeek = async (page: Page, touch = false) => {
  await page.waitForTimeout(300);
  if (touch) {
    const cv = (await page.locator('canvas').boundingBox())!;
    await page.touchscreen.tap(cv.x + cv.width * 0.3, cv.y + cv.height * 0.4);
  } else await page.keyboard.press('Space');
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              (window as unknown as GameWindow).__game!.scene.getScene(
                'Week',
              ) as WeekSceneLike
            ).started,
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
};
const gateOpen = async (page: Page, x: number) =>
  (await weekState(page)).gates.find((g) => g.x === x)?.open;
/** Нажатие с удержанием на кадр-другой: JustDown читается в update сцены; прошлое действие должно кончиться. */
const tapKey = async (page: Page, code: string, ms = 120) => {
  await expect
    .poll(async () => (await weekState(page)).busy, { timeout: 15_000 })
    .toBe(false);
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
};

test.describe('игра «Неделя»: каркас «Понедельника»', () => {
  test('от утра до двери: привычки берут цену, дверь открывает только ПАУЗА', async ({
    page,
  }) => {
    // Самый длинный сценарий смока: игровые часы на раннере без GPU идут
    // медленнее настоящих, и 30 с по умолчанию кончались до финальной надписи.
    test.setTimeout(90_000);
    await openGame(page, 'week', 'Week');
    const start = await weekState(page);
    expect(start.texts).toContain('ПОНЕДЕЛЬНИК');
    expect(start.texts).toContain('Это Саша. Пора на работу');
    expect(start.started).toBe(false);
    expect(start.revealed).toEqual([]);
    // арт хука загружен, Саша нарисован своим листом, а не блоком
    expect(start.art).toBe(true);
    expect(start.sashaSheet).toMatch(/^wk_sasha_/);

    // до старта мир стоит, после — Саша идёт сам
    await page.waitForTimeout(1000);
    expect((await weekState(page)).x).toBe(start.x);
    await startWeek(page);
    await expect
      .poll(async () => (await weekState(page)).x, { timeout: 15_000 })
      .toBeGreaterThan(start.x + 60);

    // высокая стопка держит Сашу на месте, пока не нажато ПЕРЕРАБОТАТЬ: стопка убрана, впереди новые, сил меньше
    await weekGoTo(page, 4600, 'overwork');
    await page.waitForTimeout(600);
    let s = await weekState(page);
    expect(s.x).toBeLessThan(4700);
    const gatesBefore = s.gateCount;
    await tapKey(page, 'KeyZ');
    await expect
      .poll(() => gateOpen(page, 4700), { timeout: 15_000 })
      .toBe(true);
    s = await weekState(page);
    expect(s.energy).toBeLessThan(100);
    expect(s.piles).toBeGreaterThan(0);
    expect(s.gateCount).toBeGreaterThan(gatesBefore);

    // ПРОЛИСТАТЬ: шум убран, часы перескочили, мир посерел
    await weekGoTo(page, 9380, 'scroll');
    const before = (await weekState(page)).clockMin;
    await tapKey(page, 'KeyX');
    await expect
      .poll(() => gateOpen(page, 9500), { timeout: 15_000 })
      .toBe(true);
    s = await weekState(page);
    expect(s.clockMin).toBeGreaterThan(before + 60);
    expect(s.color).toBeLessThan(1);

    // СОГЛАСИТЬСЯ: проход свободен, рюкзак тяжелее
    await weekGoTo(page, 15400, 'agree');
    await tapKey(page, 'KeyC');
    await expect
      .poll(async () => (await weekState(page)).load, { timeout: 15_000 })
      .toBe(1);
    expect(await gateOpen(page, 15500)).toBe(true);

    // пик: привычки дверь не открывают, она держится впереди, сколько ни беги
    await weekGoTo(page, 21050);
    await expect
      .poll(async () => (await weekState(page)).peak, { timeout: 15_000 })
      .toBe(true);
    for (const code of ['KeyZ', 'KeyX', 'KeyC']) {
      await tapKey(page, code);
    }
    s = await weekState(page);
    expect(s.named).toBe(false);
    expect(s.done).toBe(false);
    expect(s.doorAhead).toBeGreaterThan(200);
    expect(s.revealed).toContain('pause');

    // ПАУЗА: удержание → выбор; неверное название оставляет выбор, верное гасит сбой
    await page.keyboard.down('KeyV');
    await expect
      .poll(async () => (await weekState(page)).open, { timeout: 15_000 })
      .toBe(true);
    await page.keyboard.up('KeyV');
    expect((await weekState(page)).texts).toContain('Что сейчас происходит?');
    await tapKey(page, 'Digit1');
    s = await weekState(page);
    expect(s.open).toBe(true);
    expect(s.named).toBe(false);
    await tapKey(page, 'Digit3');
    await expect
      .poll(async () => (await weekState(page)).named, { timeout: 15_000 })
      .toBe(true);
    s = await weekState(page);
    expect(s.doorAhead).toBeLessThan(320);

    // последние десять шагов Саша проходит сам — и реплика начальницы
    await expect
      .poll(async () => (await weekState(page)).done, { timeout: 30_000 })
      .toBe(true);
    expect((await weekState(page)).texts).toContain(
      'Глянь отчёт до четверга, ладно?',
    );
    // карточка после хука: зов, продолжение, «поделиться» и кризисная строка двумя линиями
    await expect
      .poll(async () => (await weekState(page)).texts, { timeout: 30_000 })
      .toContain('Продолжение скоро');
    const card = (await weekState(page)).texts;
    for (const line of [
      'Записаться на первую встречу',
      'Попробовать в приложении',
      'Поделиться',
      'если тяжело прямо сейчас — 8-800-100-49-94, бесплатно',
      'детям и подросткам — 8-800-2000-122',
    ])
      expect(card).toContain(line);
    expect(card.some((l) => l.startsWith('В схема-терапии учатся'))).toBe(true);
    for (const name of [
      'game_chapter_start',
      'game_chapter_done',
      'game_cta_shown',
    ])
      expect(events).toContain(name);

    // зов: нажатие «Записаться» уходит событием (новая вкладка в смоке не открывается)
    await page.evaluate(() => {
      window.open = () => null;
      const sc = (window as unknown as GameWindow).__game!.scene.getScene(
        'Week',
      ) as WeekSceneLike;
      const btn = sc.children.list.find((o) =>
        o.list?.some((c) => c.text === 'Записаться на первую встречу'),
      ) as unknown as { emit(e: string): void };
      btn.emit('pointerdown');
    });
    await expect.poll(() => events).toContain('game_cta_click');
  });

  test('/game/ без хеша открывает «Неделю»', async ({ page }) => {
    await openGame(page, '', 'Week');
  });

  test.describe('с телефона', () => {
    test.use({
      viewport: { width: 800, height: 360 },
      hasTouch: true,
      isMobile: true,
    });
    test('кнопки открываются по сюжету, каждая не меньше 44×44; ПАУЗА — пальцем', async ({
      page,
    }) => {
      await openGame(page, 'week', 'Week');
      await expect(page.locator('#touch-controls.week')).toBeHidden();
      await startWeek(page, true);
      await expect(page.locator('#touch-controls.week')).toBeVisible();
      const acts = [
        ['overwork', '#tbtn-hit', 4320],
        ['scroll', '#tbtn-avoid', 9020],
        ['agree', '#tbtn-fawn', 15020],
      ] as const;
      for (const [, id] of acts) await expect(page.locator(id)).toBeHidden();
      await expect(page.locator('#tbtn-pause')).toBeHidden();
      // управление одним пальцем: влево-вправо нет, касание кадра — прыжок
      await expect(page.locator('#tbtn-left')).toBeHidden();
      const cv = (await page.locator('canvas').boundingBox())!;
      await page.touchscreen.tap(cv.x + cv.width * 0.3, cv.y + cv.height * 0.4);
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const sc = (
                window as unknown as GameWindow
              ).__game!.scene.getScene('Week') as WeekSceneLike;
              return sc.player.body.velocity.y;
            }),
          { timeout: 5_000, intervals: [30] },
        )
        .toBeLessThan(0);
      for (const [act, id, x] of acts) {
        await weekGoTo(page, x, act);
        await expect(page.locator(id)).toBeVisible();
      }
      // у двери: привычка пальцем — и появляется ПАУЗА
      await weekGoTo(page, 21050);
      await expect
        .poll(async () => (await weekState(page)).peak, { timeout: 15_000 })
        .toBe(true);
      await page.locator('#tbtn-avoid').dispatchEvent('pointerdown');
      await page.locator('#tbtn-avoid').dispatchEvent('pointerup');
      await expect(page.locator('#tbtn-pause')).toBeVisible();
      for (const id of [
        '#tbtn-hit',
        '#tbtn-avoid',
        '#tbtn-fawn',
        '#tbtn-pause',
        '#tbtn-jump',
      ]) {
        const box = (await page.locator(id).boundingBox())!;
        expect(box.width, id).toBeGreaterThanOrEqual(44);
        expect(box.height, id).toBeGreaterThanOrEqual(44);
      }
      // удержание ПАУЗЫ пальцем → выбор; верное название — третья строка панели
      await page.locator('#tbtn-pause').dispatchEvent('pointerdown');
      await expect
        .poll(async () => (await weekState(page)).open, { timeout: 15_000 })
        .toBe(true);
      await page.locator('#tbtn-pause').dispatchEvent('pointerup');
      const canvas = (await page.locator('canvas').boundingBox())!;
      const k = canvas.height / 360;
      await page.touchscreen.tap(
        canvas.x + canvas.width / 2,
        canvas.y + (72 + 30 + 2 * 60 + 26) * k,
      );
      await expect
        .poll(async () => (await weekState(page)).named, { timeout: 15_000 })
        .toBe(true);
    });
  });
});
