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
  hitstop: number;
  hearts: number;
  frozen: boolean;
  triggers: { fn(): void }[];
  voices: { doAnswer(): void }[];
  showBranch(next: string): void;
  player: {
    x: number;
    y: number;
    body: { reset(x: number, y: number): void; velocity: { y: number } };
  };
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
  { hash: 'week', scene: 'Week' },
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

  // Регрессии прогона логики (#1089): ждём состояние сцены, а не время.
  const gs = (page: Page) =>
    page.evaluate(() => {
      const sc = (window as unknown as GameWindow).__gs!();
      const { dead, hitstop, hearts, frozen } = sc;
      return { x: sc.player.x, dead, hitstop, hearts, frozen };
    });

  test('гл.1: первый стоп-кадр гасит титул главы', async ({ page }) => {
    await openGame(page, 'chapter1', 'Game');
    await page.keyboard.down('ArrowRight');
    await expect
      .poll(async () => (await gs(page)).hitstop, { timeout: 30_000 })
      .toBeGreaterThan(1e8);
    await page.keyboard.up('ArrowRight');
    const title = (await sceneTexts(page)).filter((t) =>
      t.includes('ОБЫЧНЫЙ ДЕНЬ'),
    );
    expect(title).toEqual([]);
  });

  test('гл.3: падение в первую яму — на чекпоинт 1100, а не в начало', async ({
    page,
  }) => {
    await openGame(page, 'chapter3', 'Game');
    await page.evaluate(() => {
      const sc = (window as unknown as GameWindow).__gs!();
      sc.voices.forEach((v) => v.doAnswer()); // ворота отговорок открыты
      sc.player.body.reset(1470, sc.player.y - 4);
    });
    // Пропасть → смерть или откат; жмём, пока кот снова не жив левее ямы.
    const back = async () => {
      await page.keyboard.press('Space');
      const s = await gs(page);
      return !s.dead && s.x < 1400 ? s.x : null;
    };
    await expect
      .poll(back, { timeout: 30_000, intervals: [500] })
      .not.toBeNull();
    expect((await gs(page)).x).toBeGreaterThan(1050);
  });

  test('гл.3: вход по хешу не пишет прогресс, «дальше» на развилке — пишет', async ({
    page,
  }) => {
    await openGame(page, 'chapter3', 'Game');
    const saved = () =>
      page.evaluate(() => localStorage.getItem('rtym_chapter'));
    expect(await saved()).toBeNull();
    await page.evaluate(() => {
      const sc = (window as unknown as GameWindow).__gs!();
      sc.showBranch('chapter3');
      const go = sc.children.list.find(
        (o) => o.type === 'Text' && !!o.text?.includes('путь Мистера'),
      ) as unknown as { emit(e: string): void };
      go.emit('pointerdown');
    });
    await expect.poll(saved).toBe('chapter3');
  });

  test('гл.1: раздражение жжёт и сквозь залипание', async ({ page }) => {
    await openGame(page, 'chapter1', 'Game');
    await page.evaluate(() => {
      const sc = (window as unknown as GameWindow).__gs!();
      sc.player.body.reset(1150, sc.player.y); // на земле перед ямой 1300–1520
      sc.triggers[1].fn(); // раздражение у 1620 и стоп-кадр знакомства
    });
    // Кадр закрывает само нажатие Z (слушатель — через ~700 мс), и Z остаётся зажатой:
    // раздражение подлетает быстрее, чем успели бы залипнуть отдельным нажатием.
    const frameOpen = async () => {
      await page.keyboard.up('KeyZ');
      await page.keyboard.down('KeyZ');
      return (await gs(page)).hitstop > 1e8;
    };
    await expect
      .poll(frameOpen, { timeout: 30_000, intervals: [300] })
      .toBe(false);
    // Урон должен прийти именно в залипании: до него сердца целы.
    await expect.poll(async () => (await gs(page)).frozen).toBe(true);
    expect((await gs(page)).hearts).toBe(3);
    await expect
      .poll(async () => (await gs(page)).hearts, { timeout: 30_000 })
      .toBeLessThan(3);
    await page.keyboard.up('KeyZ');
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
    await page.goto('/game/#chapter1');
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
      () => !!(window as unknown as GameWindow).__game?.scene.isActive('Game'),
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
      revealed: [...sc.revealed],
      gates: sc.world.gates.map((g) => ({ x: g.x, open: g.open })),
      gateCount: sc.world.gates.length,
      art: [
        'bg_wk_home',
        'bg_wk_street',
        'bg_wk_office',
        'bg_wk_office_glitch',
        'wk_piles',
      ].every((k) => sc.textures.exists(k)),
      sashaSheet: sc.sasha.texture.key,
      texts: sc.children.list
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
    await openGame(page, 'week', 'Week');
    const start = await weekState(page);
    expect(start.texts).toContain('Понедельник. Офис');
    expect(start.revealed).toEqual([]);
    // арт хука загружен, Саша нарисован своим листом, а не блоком
    expect(start.art).toBe(true);
    expect(start.sashaSheet).toMatch(/^wk_sasha_/);

    // утро: ни одной клавиши — Саша идёт сам
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
    await expect
      .poll(async () => (await weekState(page)).texts, { timeout: 30_000 })
      .toContain('Продолжение скоро');
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
      await page.locator('#tbtn-avoid').tap();
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
