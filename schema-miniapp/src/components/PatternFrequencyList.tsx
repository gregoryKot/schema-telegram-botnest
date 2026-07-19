// Сгруппированный список паттернов с недельной частотой (дизайн-макет
// «Паттерны»). Каждая строка: имя + тихая полоска частоты (дней/7) + «N/7».
// ОДИН спокойный акцент вместо разноцветья доменов — снижение сенсорного
// шума (нейроинклюзивность; в макете это named «not color chaos»).
// Сортировка внутри группы — по убыванию частоты (что звучит чаще — выше).
// Переиспользуется схемами и режимами (правило «одна механика — один компонент»).
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

function FreqBar({ freq, active }: { freq: number; active: boolean }) {
  // ширина 8..38px по частоте; тихий один хью
  const w = 8 + Math.round((Math.min(freq, FREQ_WINDOW) / FREQ_WINDOW) * 30);
  return (
    <span
      aria-hidden
      style={{
        display: 'block',
        width: w,
        height: 5,
        borderRadius: 3,
        background: active
          ? 'var(--accent)'
          : 'color-mix(in srgb, var(--accent) 32%, transparent)',
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
}: {
  groups: FreqGroup[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {groups.map((g) => {
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
                        color: active ? 'var(--accent)' : 'var(--text)',
                        letterSpacing: '-0.1px',
                      }}
                    >
                      {it.name}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        flexShrink: 0,
                      }}
                    >
                      <FreqBar freq={it.freq} active={active} />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-faint)',
                          minWidth: 30,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {it.freq}/{FREQ_WINDOW}
                      </span>
                    </span>
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
