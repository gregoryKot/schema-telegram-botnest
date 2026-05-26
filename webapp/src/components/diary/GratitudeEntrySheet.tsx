import { useState, useEffect } from 'react';
import { GlyphArrowLeft } from '../exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { fmtDateLong, todayStr } from '../../utils/format';
import { haptic } from '../../haptic';

interface Props {
  onClose: () => void;
  date: string;
  existingItems?: string[];
  onSave: (date: string, items: string[]) => Promise<void>;
}

const PLACEHOLDERS = [
  'Что-то хорошее, что произошло сегодня...',
  'Кто-то, кто помог или поддержал...',
  'Момент, который хочется запомнить...',
  'Что-то простое, что согрело...',
  'Что-то, что обычно не замечаешь...',
];

export function GratitudeEntrySheet({ onClose, date, existingItems, onSave }: Props) {
  const goBack = useHistorySheet(onClose);
  const existing = !existingItems ? loadDraft<{ items: string[] }>('gratitude') : null;
  const initItems = existingItems ?? existing?.data?.items ?? ['', '', ''];

  const [items, setItems] = useState<string[]>(initItems);
  const [saving, setSaving] = useState(false);

  const update = (i: number, v: string) => setItems(prev => prev.map((it, idx) => idx === i ? v : it));

  useEffect(() => {
    if (!existingItems) saveDraft('gratitude', { items });
  }, [items, existingItems]);

  const canSave = items.filter(it => it.trim().length > 0).length >= 1;

  const handleSave = async () => {
    if (!canSave || saving) return;
    haptic.success();
    setSaving(true);
    try {
      await onSave(date, items.filter(it => it.trim().length > 0));
      clearDraft('gratitude');
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
      goBack();
    }
  };

  const dateLabel = date === todayStr() ? 'сегодня' : fmtDateLong(date);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="ex-btn ex-btn-ghost" onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="ex-btn ex-btn-primary"
          style={{ padding: '6px 18px', fontSize: 14, opacity: canSave ? 1 : 0.35 }}
        >
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </button>
      </div>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '36px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', lineHeight: 1.15, marginBottom: 6 }}>
          Дневник благодарности
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 10 }}>{dateLabel}</div>
        <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 24, lineHeight: 1.6 }}>
          За что ты благодарен сегодня? Даже самое маленькое — оно важно.
        </p>

        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0, marginTop: 2,
              background: item.trim() ? '#34d39922' : 'rgba(var(--fg-rgb),0.06)',
              border: item.trim() ? '1px solid #34d39966' : '1px solid rgba(var(--fg-rgb),0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'var(--accent-green)', fontWeight: 700,
              transition: 'background 150ms, border-color 150ms',
            }}>
              {i + 1}
            </div>
            <textarea
              value={item}
              onChange={e => update(i, e.target.value)}
              placeholder={PLACEHOLDERS[i] ?? PLACEHOLDERS[PLACEHOLDERS.length - 1]}
              rows={2}
              className="field-input"
              style={{
                flex: 1, background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)',
                borderRadius: 12, padding: '10px 12px', color: 'var(--text)', fontSize: 14, lineHeight: 1.5,
                outline: 'none',
              }}
            />
          </div>
        ))}

        {items.length < 5 && (
          <button onClick={() => setItems(prev => [...prev, ''])} style={{
            background: 'rgba(var(--fg-rgb),0.05)', border: '1px dashed rgba(var(--fg-rgb),0.15)',
            borderRadius: 12, padding: '10px', width: '100%', color: 'var(--text-sub)',
            fontSize: 13, cursor: 'pointer', marginBottom: 4,
          }}>
            + добавить ещё
          </button>
        )}
      </div>
    </div>
  );
}
