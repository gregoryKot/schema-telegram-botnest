import { useSyncExternalStore, type CSSProperties } from 'react';
import {
  subscribe,
  getVersion,
  isPerfHudEnabled,
  setPerfHudEnabled,
  getTaps,
  getMarks,
  getJanks,
  getJankSummary,
  getTimerJankSummary,
  formatReport,
  SECTION_LABELS,
} from '../utils/perfLog';

// Панель замеров скорости поверх приложения (см. perfLog.ts — зачем и что
// меряется). Включение/выключение — пять тапов по строке версии в
// «О приложении»; обычный пользователь панель не видит. Кнопка
// «Скопировать» кладёт полный отчёт в буфер — чтобы прислать текстом, а не
// скриншотом.

const btnStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.14)',
  color: 'inherit',
  border: 'none',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 11,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

export function PerfHud() {
  useSyncExternalStore(subscribe, getVersion);
  if (!isPerfHudEnabled()) return null;
  const taps = getTaps().slice(-8);
  const marks = getMarks();
  const jank = getJankSummary();
  // Пять самых длинных блоков с моментами — по ним видно, КОГДА поток
  // вязнет; полный список уезжает в отчёт кнопкой «Скопировать».
  const topJanks = getJanks()
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5)
    .sort((a, b) => a.atMs - b.atMs);
  const sec = (ms: number) => `${(ms / 1000).toFixed(1)}с`;
  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        left: 8,
        right: 8,
        zIndex: 300,
        background: 'rgba(10, 12, 10, 0.82)',
        color: '#9fdf9f',
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.6,
        borderRadius: 10,
        padding: '8px 10px',
        maxHeight: '38vh',
        overflowY: 'auto',
      }}
    >
      <div>
        метки: {marks.map((m) => `${m.name} ${sec(m.atMs)}`).join(' · ') || '—'}
      </div>
      <div>
        таймер-паузы &gt;300мс: {getTimerJankSummary().count} шт ·{' '}
        {sec(getTimerJankSummary().totalMs)} всего
      </div>
      <div>
        блоки &gt;100мс: {jank.count} шт · {sec(jank.totalMs)} всего
        {topJanks.length > 0 &&
          ` · топ: ${topJanks
            .map((b) => `${Math.round(b.ms)}мс@${sec(b.atMs)}`)
            .join(' ')}`}
      </div>
      {taps.length === 0 ? (
        <div>тапов по вкладкам ещё не было</div>
      ) : (
        taps.map((t, i) => (
          <div key={i}>
            {SECTION_LABELS[t.target]} на {sec(t.atMs)}: {Math.round(t.ms)}
            мс (очередь {Math.round(t.delayMs)} + экран{' '}
            {Math.round(t.ms - t.delayMs)}, {t.cold ? 'сборка' : 'показ'})
          </div>
        ))
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button
          style={btnStyle}
          onClick={() => {
            navigator.clipboard
              .writeText(formatReport())
              .catch((e) => console.error('perf report copy failed', e));
          }}
        >
          Скопировать
        </button>
        <button style={btnStyle} onClick={() => setPerfHudEnabled(false)}>
          Выключить
        </button>
      </div>
    </div>
  );
}
