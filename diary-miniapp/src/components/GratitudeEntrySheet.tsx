import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { haptic } from '../haptic';

interface Props {
  onClose: () => void;
  date: string;
  existingItems?: string[];
  onSave: (date: string, items: string[]) => Promise<void>;
}

const TODAY = new Date().toISOString().split('T')[0];
const COLOR = '#34d399';

export function GratitudeEntrySheet({ onClose, date, existingItems, onSave }: Props) {
  const [items, setItems] = useState<string[]>(existingItems ?? ['', '', '']);
  const [saving, setSaving] = useState(false);

  const update = (i: number, v: string) => setItems(prev => prev.map((it, idx) => idx === i ? v : it));

  const canSave = items.filter(it => it.trim().length > 0).length >= 1;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave(date, items.filter(it => it.trim().length > 0));
      haptic.success();
      onClose();
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) => {
    if (d === TODAY) return 'сегодня';
    return new Date(d).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Дневник благодарности</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginBottom: 20 }}>
          {formatDate(date)}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.48)', marginBottom: 18, lineHeight: 1.6 }}>
          Три вещи, за которые ты благодарен. Даже маленькие — они тоже считаются.
        </div>

        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0, marginTop: 2,
              background: item.trim() ? `${COLOR}28` : 'rgba(255,255,255,0.06)',
              border: item.trim() ? `1px solid ${COLOR}55` : '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: COLOR, fontWeight: 700,
              transition: 'background 150ms, border-color 150ms',
            }}>
              {i + 1}
            </div>
            <textarea
              value={item}
              onChange={e => update(i, e.target.value)}
              placeholder={['Что-то хорошее, что случилось...', 'Кто-то или что-то, что помогло...', 'Момент, который запомнился...'][i]}
              rows={2}
              className="field-input"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '10px 12px',
                color: '#fff',
                fontSize: 14,
                lineHeight: 1.5,
                outline: 'none',
              }}
            />
          </div>
        ))}

        {items.length < 5 && (
          <button onClick={() => setItems(prev => [...prev, ''])} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.13)',
            borderRadius: 12, padding: '10px', width: '100%',
            color: 'rgba(255,255,255,0.38)',
            fontSize: 13, cursor: 'pointer', marginBottom: 4,
          }}>
            + ещё одна вещь
          </button>
        )}

        <button onClick={handleSave} disabled={!canSave || saving} style={{
          marginTop: 20, width: '100%', padding: '15px', borderRadius: 14,
          background: canSave ? COLOR : 'rgba(255,255,255,0.09)',
          color: canSave ? '#0d0f18' : 'rgba(255,255,255,0.28)',
          border: 'none', fontSize: 16, fontWeight: 700, cursor: canSave ? 'pointer' : 'default',
          transition: 'background 200ms, color 200ms',
        }}>
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </button>
      </div>
    </BottomSheet>
  );
}
