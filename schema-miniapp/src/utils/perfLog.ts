import type { Section } from '../components/BottomNav';

// Журнал замеров скорости на устройстве владельца. Неделя отладки «первую
// минуту тормозит» (2026-08-19…26) упёрлась в то, что симптом живёт только
// на реальном телефоне: стенд с CPU-троттлингом воспроизводил его лишь
// частично, а гипотеза про service worker (#426) не подтвердилась. Панель
// (PerfHud) показывает три вещи: миллисекунды каждого тапа по вкладке
// (от касания до отрисовки), блокировки главного потока в первые две минуты
// (дыры между кадрами rAF) и метки старта (когда приехали данные, когда
// собрались фоновые вкладки). Включение — пять тапов по строке версии в
// «О приложении» (BuildInfoLine); обычный пользователь панель не видит.
//
// Запись тапов и меток идёт всегда (дёшево: массивы с потолком), монитор
// кадров — только при включённой панели.

const HUD_KEY = 'perf_hud_on';

export interface TapEntry {
  target: Section;
  /** Момент КАСАНИЯ (event.timeStamp) — «на какой секунде жизни». */
  atMs: number;
  /** Палец → отрисовка, целиком. */
  ms: number;
  /** Сколько из ms событие простояло в очереди за блоком главного потока,
   *  ДО того как приложение вообще о нём узнало. Итерация 2 (2026-08-26):
   *  владелец увидел «1мс», прождав ~3с — вся задержка была в очереди,
   *  замер от начала обработчика её не видел. */
  delayMs: number;
  /** true = вкладка собиралась под тапом (не была смонтирована заранее). */
  cold: boolean;
}
interface Mark {
  name: string;
  atMs: number;
}
interface Jank {
  atMs: number;
  ms: number;
}

const marks: Mark[] = [];
const taps: TapEntry[] = [];
const janks: Jank[] = [];
const timerJanks: Jank[] = [];
let pendingTap: {
  target: Section;
  t0: number;
  delayMs: number;
} | null = null;
let version = 0;
const listeners = new Set<() => void>();

const now = () => performance.now();
function notify(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export const SECTION_LABELS: Record<Section, string> = {
  today: 'Сегодня',
  help: 'Помощь',
  schemas: 'Паттерны',
  profile: 'Я',
};

export function isPerfHudEnabled(): boolean {
  return localStorage.getItem(HUD_KEY) === '1';
}

export function setPerfHudEnabled(on: boolean): void {
  localStorage.setItem(HUD_KEY, on ? '1' : '0');
  notify();
}

/** Подписка панели на новые записи (useSyncExternalStore). */
export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getVersion = (): number => version;

export function perfMark(name: string): void {
  marks.push({ name, atMs: now() });
  if (marks.length > 40) marks.shift();
  notify();
}

/** Касание кнопки вкладки (pointerdown в BottomNav). eventTs —
 *  event.timeStamp: момент, когда палец РЕАЛЬНО коснулся экрана. Обработчик
 *  запускается позже, если главный поток был занят, — разница и есть
 *  очередь. Неправдоподобный eventTs (эпоха-время в старых WebKit, будущее)
 *  отбрасывается — тогда очередь честно неизвестна (0). */
export function tapStart(target: Section, eventTs?: number): void {
  const handlerAt = now();
  const tsValid =
    typeof eventTs === 'number' &&
    eventTs <= handlerAt &&
    handlerAt - eventTs < 60_000;
  const t0 = tsValid ? eventTs : handlerAt;
  pendingTap = { target, t0, delayMs: handlerAt - t0 };
}

/** Экран отрисован (двойной rAF после смены section — usePerfTapTracking).
 *  Без парного tapStart (смена свайпом, начальный маунт) — игнорируется. */
export function tapDone(target: Section, cold: boolean): void {
  if (!pendingTap || pendingTap.target !== target) {
    pendingTap = null;
    return;
  }
  taps.push({
    target,
    atMs: pendingTap.t0,
    ms: now() - pendingTap.t0,
    delayMs: pendingTap.delayMs,
    cold,
  });
  if (taps.length > 15) taps.shift();
  pendingTap = null;
  notify();
}

export function recordJank(atMs: number, ms: number): void {
  janks.push({ atMs, ms });
  if (janks.length > 200) janks.shift();
  notify();
}

const JANK_GAP_MS = 100;
const JANK_WINDOW_MS = 120_000;
const TIMER_TICK_MS = 100;
const TIMER_GAP_MS = 300;

/** Второй монитор, НЕЗАВИСИМЫЙ от кадров: setInterval(100мс). Прогон
 *  2026-08-26 показал метроном — rAF-кадры шли ровно раз в ~1.5с первую
 *  минуту (42 «блока» по ~1490мс), при этом бенчмарк исполнялся быстро.
 *  Это почерк троттлинга ОТРИСОВКИ, а не занятого потока; таймер-монитор
 *  их различает: таймеры молчат вместе с кадрами → задушен весь процесс;
 *  таймеры тикают, кадры стоят → задушен только рендер-конвейер. */
export function startTimerMonitor(): void {
  if (!isPerfHudEnabled()) return;
  let last = now();
  const id = setInterval(() => {
    const t = now();
    if (t - last > TIMER_GAP_MS) {
      timerJanks.push({ atMs: last, ms: t - last });
      if (timerJanks.length > 200) timerJanks.shift();
      notify();
    }
    last = t;
    if (t > JANK_WINDOW_MS) clearInterval(id);
  }, TIMER_TICK_MS);
}

/** Метки видимости/фокуса страницы: если первую минуту страница числится
 *  hidden или без фокуса — вот причина, по которой WebKit душит отрисовку. */
export function watchVisibility(): void {
  if (!isPerfHudEnabled()) return;
  const state = () =>
    `видимость:${document.visibilityState}${document.hasFocus() ? '+фокус' : '-фокус'}`;
  perfMark(state());
  document.addEventListener('visibilitychange', () => perfMark(state()));
  window.addEventListener('focus', () => perfMark(state()));
  window.addEventListener('blur', () => perfMark(state()));
}

/** Дыры между кадрами первые 2 минуты жизни приложения: кадр, пришедший
 *  позже чем через 100мс, — это блокировка главного потока, тап в этот
 *  момент ждал бы её целиком. Только при включённой панели. */
export function startJankMonitor(): void {
  if (!isPerfHudEnabled()) return;
  let last = now();
  const loop = (): void => {
    const t = now();
    if (t - last > JANK_GAP_MS) recordJank(last, t - last);
    last = t;
    if (t < JANK_WINDOW_MS) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// Одинаковая порция чистой арифметики. Смысл — сравнить СКОРОСТЬ исполнения
// JS между площадками на одном телефоне: тот же код в Telegram летает, а в
// PWA первую минуту вязнет; если бенчмарк в PWA в разы медленнее — движок
// исполняет код без JIT, и чинить надо объём стартовой работы, а не искать
// «лишний» код. Два прогона (3с и 75с жизни) покажут, разгоняется ли движок.
let benchSink = 0;
export function runMicroBench(): number {
  const t0 = now();
  let x = 2463534242;
  let acc = 0;
  for (let i = 0; i < 3_000_000; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    acc = (acc + (x & 0xff)) | 0;
  }
  benchSink = acc;
  return now() - t0;
}
export const _benchSink = () => benchSink;

/** Только при включённой панели: сам бенчмарк — это блок потока. */
export function scheduleBenchmarks(): void {
  if (!isPerfHudEnabled()) return;
  const run = (label: string) =>
    perfMark(`${label}=${Math.round(runMicroBench())}мс`);
  setTimeout(() => run('бенч1'), 3_000);
  setTimeout(() => run('бенч2'), 75_000);
}

const sec = (ms: number) => `${(ms / 1000).toFixed(1)}с`;

export function getTaps(): TapEntry[] {
  return [...taps];
}
export function getMarks(): Mark[] {
  return [...marks];
}
export function getJanks(): Jank[] {
  return [...janks];
}
export function getJankSummary(): { count: number; totalMs: number } {
  return { count: janks.length, totalMs: janks.reduce((s, j) => s + j.ms, 0) };
}
export function getTimerJankSummary(): { count: number; totalMs: number } {
  return {
    count: timerJanks.length,
    totalMs: timerJanks.reduce((s, j) => s + j.ms, 0),
  };
}

export function formatReport(): string {
  const lines: string[] = [];
  lines.push(
    `метки: ${marks.map((m) => `${m.name} ${sec(m.atMs)}`).join(' · ') || '—'}`,
  );
  const j = getJankSummary();
  lines.push(
    `блоки >${JANK_GAP_MS}мс за первые 2 мин: ${j.count} шт, ${sec(j.totalMs)} всего`,
  );
  for (const b of janks) {
    lines.push(`  блок на ${sec(b.atMs)}: ${Math.round(b.ms)}мс`);
  }
  const tj = getTimerJankSummary();
  lines.push(
    `таймер-паузы >${TIMER_GAP_MS}мс (шаг ${TIMER_TICK_MS}мс): ${tj.count} шт, ${sec(tj.totalMs)} всего`,
  );
  for (const b of timerJanks) {
    lines.push(`  таймер-пауза на ${sec(b.atMs)}: ${Math.round(b.ms)}мс`);
  }
  for (const t of taps) {
    lines.push(
      `тап ${SECTION_LABELS[t.target]} на ${sec(t.atMs)}: ${Math.round(t.ms)}мс` +
        ` (очередь ${Math.round(t.delayMs)} + экран ${Math.round(t.ms - t.delayMs)}, ${t.cold ? 'сборка' : 'показ'})`,
    );
  }
  if (taps.length === 0) lines.push('тапов по вкладкам ещё не было');
  return lines.join('\n');
}

/** Только для тестов. */
export function _resetPerfLog(): void {
  marks.length = 0;
  taps.length = 0;
  janks.length = 0;
  timerJanks.length = 0;
  pendingTap = null;
}
