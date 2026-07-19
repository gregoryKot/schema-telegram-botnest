// Сгруппированный список паттернов с недельной частотой (дизайн-макет
// «Паттерны»). ОДИН спокойный акцент вместо разноцветья доменов — снижение
// сенсорного шума. Переиспользуется схемами и режимами.
//
// ВАЖНО (нейроинклюзивность, анти-стыд): частота — НЕ табло успеваемости.
// Схемы, которые за неделю не всплывали, показываем просто названием — без
// полоски и без цифры. Знаменателя-квоты «/7» нет вовсе: он читается как
// цель, которую ты «не выполнил». У тех, что были, — мягкая полоска и «N дн.»
// как наблюдение, а не оценка. Что не звучало — уходит вниз списка тихо.
import { pressable } from '../utils/a11y';

export const FREQ_WINDOW = 7;

export interface FreqItem {
  id: string;
  name: string;
  freq: number; // дней за неделю, 0..7
}

export interface FreqGroup {
  title: string;
  items: FreqItem[];
}

function dayWord(n: number): string {
  const m10 = n % 10,
    m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return 'дней';
  if (m10 === 1) return 'день';
  if (m10 >= 2 && m10 <= 4) return 'дня';
  return 'дней';
}

function FreqBar({ freq }: { freq: number }) {
  const w = 8 + Math.round((Math.min(freq, FREQ_WINDOW) / FREQ_WINDOW) * 30);
  return (
    <span
      aria-hidden
      style={{
        display: 'block',
        width: w,
        height: 5,
        borderRadius: 3,
        background: 'color-mix(in srgb, var(--accent) 45%, transparent)',
      }}
    />
  );
}

export function PatternFrequencyList({
  groups,
  selectedId,
  onSelect,
  addLabel,
  onAdd,
  hint,
  anyFreq,
}: {
  groups: FreqGroup[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  addLabel: string;
  onAdd: () => void;
  /** Пояснение к полоскам — показываем только когда есть что пояснять */
  hint?: string;
  /** Есть ли вообще ненулевая частота (иначе полоски/подсказку не показываем) */
  anyFreq?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {anyFreq && hint && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.45,
            margin: '-6px 2px -8px',
          }}
        >
          {hint}
        </div>
      )}
      {groups.map((g) => {
        // Что всплывало — выше (по убыванию), остальное — тихо ниже.
        const items = [...g.items].sort((a, b) => b.freq - a.freq);
        return (
          <div key={g.title}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                padding: '0 2px 8px',
              }}
            >
              <span className="section-label">{g.title}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-faint)',
                }}
              >
                {g.items.length}
              </span>
            </div>
            <div
              className="card"
              style={{ borderRadius: 16, overflow: 'hidden' }}
            >
              {items.map((it, i) => {
                const active = it.id === selectedId;
                const shown = it.freq > 0;
                return (
                  <button
                    key={it.id}
                    {...pressable(() => onSelect(it.id))}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '14px 16px',
                      border: 'none',
                      borderTop:
                        i === 0 ? 'none' : '1px solid var(--border-color)',
                      background: active
                        ? 'color-mix(in srgb, var(--accent) 7%, transparent)'
                        : 'transparent',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: active ? 700 : 500,
                        color: active
                          ? 'var(--accent)'
                          : shown
                            ? 'var(--text)'
                            : 'var(--text-sub)',
                        letterSpacing: '-0.1px',
                      }}
                    >
                      {it.name}
                    </span>
                    {shown ? (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          flexShrink: 0,
                        }}
                      >
                        <FreqBar freq={it.freq} />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: 'var(--text-faint)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {it.freq} {dayWord(it.freq)}
                        </span>
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        style={{
                          color: 'var(--text-faint)',
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        ›
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <button
        {...pressable(onAdd)}
        style={{
          width: '100%',
          padding: 15,
          background: 'transparent',
          border: '1.5px dashed var(--border-color)',
          borderRadius: 14,
          color: 'var(--text-sub)',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}
