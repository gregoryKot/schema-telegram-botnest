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
  /** performance.now() в момент касания — «на какой секунде жизни». */
  atMs: number;
  ms: number;
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
let pendingTap: { target: Section; t0: number } | null = null;
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

/** Касание кнопки вкладки (pointerdown в BottomNav). */
export function tapStart(target: Section): void {
  pendingTap = { target, t0: now() };
}

/** Экран отрисован (двойной rAF после смены section — usePerfTapTracking).
 *  Без парного tapStart (смена свайпом, начальный маунт) — игнорируется. */
export function tapDone(target: Section, cold: boolean): void {
  if (!pendingTap || pendingTap.target !== target) {
    pendingTap = null;
    return;
  }
  taps.push({ target, atMs: pendingTap.t0, ms: now() - pendingTap.t0, cold });
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

const sec = (ms: number) => `${(ms / 1000).toFixed(1)}с`;

export function getTaps(): TapEntry[] {
  return [...taps];
}
export function getMarks(): Mark[] {
  return [...marks];
}
export function getJankSummary(): { count: number; totalMs: number } {
  return { count: janks.length, totalMs: janks.reduce((s, j) => s + j.ms, 0) };
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
  for (const t of taps) {
    lines.push(
      `тап ${SECTION_LABELS[t.target]} на ${sec(t.atMs)}: ${Math.round(t.ms)}мс (${t.cold ? 'сборка' : 'показ'})`,
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
  pendingTap = null;
}
