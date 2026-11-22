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
  ps: { open: boolean; slips: number; slipMs: number };
  ch: { id: string };
  half: boolean;
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
      slips: sc.ps.slips,
      slipMs: sc.ps.slipMs,
      chapter: sc.ch.id,
      half: sc.half,
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
        'bg_wk_city_eve',
        'bg_wk_flat',
        'bg_wk_flat_glitch',
        'wk_mom_screen',
        'wk_call_wall',
        'wk_mom_call',
        'bg_wk_party',
        'bg_wk_party_glitch',
        'bg_wk_exit_floor',
        'wk_friend_cake',
        'wk_guest_ask',
        'wk_dishes',
        'wk_mask_wall',
        'bg_wk_quiet',
        'bg_wk_quiet_void',
        'wk_little',
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
  const started = () =>
    page.evaluate(
      () =>
        (
          (window as unknown as GameWindow).__game!.scene.getScene(
            'Week',
          ) as WeekSceneLike
        ).started,
    );
  // арт всех глав грузится до заставки: нажатие повторяется, пока сцена его не услышит
  await expect
    .poll(
      async () => {
        if (await started()) return true;
        if (touch) {
          const cv = (await page.locator('canvas').boundingBox())!;
          await page.touchscreen.tap(
            cv.x + cv.width * 0.3,
            cv.y + cv.height * 0.4,
          );
        } else await page.keyboard.press('Space');
        return false;
      },
      { timeout: 15_000, intervals: [300] },
    )
    .toBe(true);
};
const gateOpen = async (page: Page, x: number) =>
  (await weekState(page)).gates.find((g) => g.x === x)?.open;
/** Кнопка карточки (контейнер с подписью) — нажатие как пальцем. */
const pressCardButton = (page: Page, text: string) =>
  page.evaluate((label) => {
    const sc = (window as unknown as GameWindow).__game!.scene.getScene(
      'Week',
    ) as WeekSceneLike;
    const btn = sc.children.list.find((o) =>
      o.list?.some((c) => c.text === label),
    ) as unknown as { emit(e: string): void };
    btn.emit('pointerdown');
  }, text);
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
    // карточка после хука: зов, продолжение («Дальше — среда»), «поделиться» и кризисная строка двумя линиями
    await expect
      .poll(async () => (await weekState(page)).texts, { timeout: 30_000 })
      .toContain('Дальше — среда');
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

    // «Дальше — среда» открывает следующую главу в той же сцене
    await pressCardButton(page, 'Дальше — среда');
    await expect
      .poll(async () => (await weekState(page)).chapter, { timeout: 15_000 })
      .toBe('wed');
    expect((await weekState(page)).texts).toContain('СРЕДА');
  });

  test('«Среда»: от звонка до тёплой фразы — ПАУЗА в два шага: назвать, затем что нужно', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openGame(page, 'wed', 'Week');
    const start = await weekState(page);
    expect(start.chapter).toBe('wed');
    expect(start.texts).toContain('Это Саша. Вечер дома, звонит мама');
    expect(start.art).toBe(true);
    await startWeek(page);
    // привычки открываются по сюжету и берут цену и здесь
    await weekGoTo(page, 3420, 'overwork');
    await weekGoTo(page, 6520, 'scroll');
    await weekGoTo(page, 10720, 'agree');
    await weekGoTo(page, 11200);
    await tapKey(page, 'KeyC');
    await expect
      .poll(async () => (await weekState(page)).load, { timeout: 15_000 })
      .toBe(1);
    // пик: мама-телефон держится впереди, привычки не помогают — появляется ПАУЗА
    await weekGoTo(page, 17060);
    await expect
      .poll(async () => (await weekState(page)).peak, { timeout: 15_000 })
      .toBe(true);
    await tapKey(page, 'KeyX');
    await expect
      .poll(async () => (await weekState(page)).revealed, { timeout: 15_000 })
      .toContain('pause');
    const hold = async () => {
      await page.keyboard.down('KeyV');
      await expect
        .poll(async () => (await weekState(page)).open, { timeout: 15_000 })
        .toBe(true);
      await page.keyboard.up('KeyV');
    };
    // шаг 1: назвать. Верное название не гасит сбой — стены стоят, Саша думает, что нужно
    await hold();
    let s = await weekState(page);
    expect(s.texts).toContain('ПАУЗА · шаг 1 из 2: назвать');
    await tapKey(page, 'Digit2');
    await expect
      .poll(async () => (await weekState(page)).half, { timeout: 15_000 })
      .toBe(true);
    s = await weekState(page);
    expect(s.named).toBe(false);
    expect(s.texts).toContain('Названо. А стены стоят — что мне нужно?');
    // шаг 2: что нужно. Неверный ответ оставляет выбор, верный открывает путь к маме
    await hold();
    s = await weekState(page);
    expect(s.texts).toContain('Что мне сейчас нужно?');
    await tapKey(page, 'Digit1');
    expect((await weekState(page)).open).toBe(true);
    await tapKey(page, 'Digit3');
    await expect
      .poll(async () => (await weekState(page)).named, { timeout: 15_000 })
      .toBe(true);
    await expect
      .poll(async () => (await weekState(page)).done, { timeout: 30_000 })
      .toBe(true);
    expect((await weekState(page)).texts).toContain(
      'Я просто соскучилась. Береги себя',
    );
    // конец главы без зова: дальше — пятница, ещё раз, поделиться
    await expect
      .poll(async () => (await weekState(page)).texts, { timeout: 30_000 })
      .toContain('Дальше — пятница');
    const end = (await weekState(page)).texts;
    expect(end).toContain('Ещё раз');
    expect(end).not.toContain('Записаться на первую встречу');
    for (const name of ['game_chapter_start', 'game_chapter_done'])
      expect(events).toContain(name);
    await pressCardButton(page, 'Дальше — пятница');
    await expect
      .poll(async () => (await weekState(page)).chapter, { timeout: 15_000 })
      .toBe('fri');
    expect((await weekState(page)).texts).toContain('ПЯТНИЦА');
  });

  test('«Пятница»: ПАУЗА срывается дважды без штрафа, с третьего удержания держится; Саша остаётся', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openGame(page, 'fri', 'Week');
    const start = await weekState(page);
    expect(start.chapter).toBe('fri');
    expect(start.texts).toContain('Это Саша. Вечеринка у друзей');
    expect(start.art).toBe(true);
    await startWeek(page);
    // первой открывается ПРОЛИСТАТЬ: два ухода в телефон — и вечер прошёл мимо, пик наступает сам
    await weekGoTo(page, 3420, 'scroll');
    await tapKey(page, 'KeyX');
    await expect
      .poll(async () => (await weekState(page)).clockMin, { timeout: 15_000 })
      .toBe(22 * 60 + 30);
    await tapKey(page, 'KeyX');
    await expect
      .poll(async () => (await weekState(page)).peak, { timeout: 15_000 })
      .toBe(true);
    await tapKey(page, 'KeyX');
    await expect
      .poll(async () => (await weekState(page)).revealed, { timeout: 15_000 })
      .toContain('pause');
    // срыв: мир замирает и срывается сам; Саша на месте, сил и груза столько же, плашка объясняет
    const slip = async (n: number, tag: string, thought: string) => {
      const before = await weekState(page);
      await page.keyboard.down('KeyV');
      await expect
        .poll(async () => (await weekState(page)).slipMs, { timeout: 15_000 })
        .toBeGreaterThan(0);
      expect((await weekState(page)).texts).toContain('держится…');
      await expect
        .poll(async () => (await weekState(page)).slips, { timeout: 15_000 })
        .toBe(n);
      await page.keyboard.up('KeyV');
      const s = await weekState(page);
      expect(s.open).toBe(false);
      expect(s.texts).toContain(tag);
      expect(s.texts).toContain(thought);
      expect(s.energy).toBe(before.energy);
      expect(s.x).toBeGreaterThanOrEqual(before.x);
      await page.waitForTimeout(150); // кнопка отпущена — сцена это увидела
    };
    await slip(
      1,
      'сорвалось — так бывает',
      'Сорвалось. Это навык, а не кнопка. Ещё раз',
    );
    await slip(2, 'уже дольше', 'Продержалось дольше. Ещё раз — и удержу');
    const hold = async () => {
      await page.keyboard.down('KeyV');
      await expect
        .poll(async () => (await weekState(page)).open, { timeout: 15_000 })
        .toBe(true);
      await page.keyboard.up('KeyV');
    };
    // третье удержание держится: назвать, затем что нужно
    await hold();
    expect((await weekState(page)).texts).toContain(
      'ПАУЗА держится · шаг 1 из 2: назвать',
    );
    await tapKey(page, 'Digit2');
    await expect
      .poll(async () => (await weekState(page)).half, { timeout: 15_000 })
      .toBe(true);
    await hold();
    await tapKey(page, 'Digit2');
    await expect
      .poll(async () => (await weekState(page)).named, { timeout: 15_000 })
      .toBe(true);
    await expect
      .poll(async () => (await weekState(page)).done, { timeout: 30_000 })
      .toBe(true);
    expect((await weekState(page)).texts).toContain(
      'О, ты тут! Держи кусок, я рядом',
    );
    await expect
      .poll(async () => (await weekState(page)).texts, { timeout: 30_000 })
      .toContain('Дальше — воскресенье');
    await pressCardButton(page, 'Дальше — воскресенье');
    await expect
      .poll(async () => (await weekState(page)).chapter, { timeout: 15_000 })
      .toBe('sun');
    for (const name of ['game_chapter_start', 'game_chapter_done'])
      expect(events).toContain(name);
  });

  test('«Воскресенье»: привычкам не за что зацепиться, ПАУЗА в два шага; кризисная строка на экране всю главу', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openGame(page, 'sun', 'Week');
    const start = await weekState(page);
    expect(start.chapter).toBe('sun');
    expect(start.texts).toContain('Это Саша. Выходной, дома никого');
    expect(start.art).toBe(true);
    const crisis = [
      'если тяжело прямо сейчас — 8-800-100-49-94, бесплатно',
      'детям и подросткам — 8-800-2000-122',
    ];
    for (const line of crisis) expect(start.texts).toContain(line);
    await startWeek(page);
    // тихий сбой: маленький Саша впереди и не приближается, преград нет
    await weekGoTo(page, 1720, 'overwork');
    const far = await weekState(page);
    expect(far.gateCount).toBe(0);
    expect(far.texts).toContain('цель: дойти до маленького Саши');
    expect(far.texts).toContain('Саша, 6 лет');
    for (const line of crisis) expect(far.texts).toContain(line);
    // привычки срабатывают вхолостую: сил, часов и груза столько же, строка говорит почему
    await tapKey(page, 'KeyZ');
    await expect
      .poll(async () => (await weekState(page)).texts, { timeout: 15_000 })
      .toContain('дел нет');
    await weekGoTo(page, 4120, 'agree');
    await tapKey(page, 'KeyX');
    await expect
      .poll(async () => (await weekState(page)).texts, { timeout: 15_000 })
      .toContain('лента кончилась');
    await tapKey(page, 'KeyC');
    await expect
      .poll(async () => (await weekState(page)).texts, { timeout: 15_000 })
      .toContain('соглашаться не с кем');
    const after = await weekState(page);
    expect(after.energy).toBe(far.energy);
    expect(after.load).toBe(far.load);
    expect(after.gateCount).toBe(0);
    expect(after.doorAhead).toBeGreaterThan(300);
    // пик: привычка и тут вхолостую — появляется ПАУЗА, она держится с первого раза
    await weekGoTo(page, 5320);
    await expect
      .poll(async () => (await weekState(page)).peak, { timeout: 15_000 })
      .toBe(true);
    await tapKey(page, 'KeyX');
    await expect
      .poll(async () => (await weekState(page)).revealed, { timeout: 15_000 })
      .toContain('pause');
    expect((await weekState(page)).gateCount).toBe(0);
    const hold = async () => {
      await page.keyboard.down('KeyV');
      await expect
        .poll(async () => (await weekState(page)).open, { timeout: 15_000 })
        .toBe(true);
      await page.keyboard.up('KeyV');
    };
    await hold();
    expect(
      (await weekState(page)).texts.some((t) => t.includes('Мне одиноко')),
    ).toBe(true);
    await tapKey(page, 'Digit3');
    await expect
      .poll(async () => (await weekState(page)).half, { timeout: 15_000 })
      .toBe(true);
    await hold();
    await tapKey(page, 'Digit1');
    await expect
      .poll(async () => (await weekState(page)).named, { timeout: 15_000 })
      .toBe(true);
    await expect
      .poll(async () => (await weekState(page)).done, { timeout: 30_000 })
      .toBe(true);
    expect((await weekState(page)).texts).toContain(
      'Женя: я хожу к терапевту, мне помогает',
    );
    await expect
      .poll(async () => (await weekState(page)).texts, { timeout: 30_000 })
      .toContain('Продолжение скоро');
    // конец тяжёлой главы — тоже с кризисной строкой
    for (const line of crisis)
      expect((await weekState(page)).texts).toContain(line);
    for (const name of ['game_chapter_start', 'game_chapter_done'])
      expect(events).toContain(name);
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
