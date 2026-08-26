import type { RefObject } from 'react';
import { SectionLabel } from '../SectionLabel';
import { pressable } from '../../utils/a11y';

// Выбор сущности для задания «изучить»: один список-пилюли на схемы и на
// режимы. Раньше это были два одинаковых блока, различавшихся подписью,
// источником списка и парой состояний. Вынесено из TaskCreateSheet.tsx
// (правило №10 + «одна механика — один компонент»).
export function TaskEntityPicker({
  containerRef,
  label,
  items,
  selectedId,
  onSelect,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  label: string;
  items: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div ref={containerRef} style={{ marginBottom: 20 }}>
      <SectionLabel mb={10}>{label}</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((s) => (
          <div
            key={s.id}
            {...pressable(() => onSelect(s.id))}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--r-12)',
              cursor: 'pointer',
              background:
                selectedId === s.id
                  ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                  : 'rgba(var(--fg-rgb),0.03)',
              border: `1px solid ${selectedId === s.id ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'rgba(var(--fg-rgb),0.07)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-10)',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: selectedId === s.id ? 'var(--accent)' : 'var(--text)',
              }}
            >
              {s.name}
            </div>
            {selectedId === s.id && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 14,
                  color: 'var(--accent)',
                }}
              >
                ✓
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
