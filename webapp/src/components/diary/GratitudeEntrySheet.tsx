import { useState, useEffect } from 'react';
import { ExScreen, GlyphCheck, GlyphPlus } from '../exercises/ExScreen';
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
  'Что-то хорошее, что произошло сегодня…',
  'Кто-то, кто помог или поддержал…',
  'Момент, который хочется запомнить…',
  'Что-то простое, что согрело…',
  'Что-то, что обычно не замечаешь…',
];

export function GratitudeEntrySheet({ onClose, date, existingItems, onSave }: Props) {
  const goBack = useHistorySheet(onClose);
  const existing = !existingItems ? loadDraft<{ items: string[] }>('gratitude') : null;
  const initItems = existingItems ?? existing?.data?.items ?? ['', '', ''];

  const [items, setItems] = useState<string[]>(initItems);
  const [saving, setSaving] = useState(false);

  const update = (i: number, v: string) => setItems(prev => prev.map((it, idx) => idx === i ? v : it));
  const addItem = () => { haptic.select(); setItems(prev => prev.length < 5 ? [...prev, ''] : prev); };

  useEffect(() => {
    if (!existingItems) saveDraft('gratitude', { items });
  }, [items, existingItems]);

  const filled = items.filter(it => it.trim().length > 0);
  const canSave = filled.length >= 1;

  const handleSave = async () => {
    if (!canSave || saving) return;
    haptic.success();
    setSaving(true);
    try {
      await onSave(date, filled);
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
    <ExScreen
      onBack={goBack}
      eyebrow={`Дневник благодарности · ${dateLabel}`}
      eyebrowColor="var(--c-moss)"
      title={<>Три вещи,<br /><span className="it">за которые сегодня — спасибо</span></>}
      lede="Даже самое маленькое. Особенно — самое маленькое. Запоминается то, что назвал."
      aside={
        <div className="aside-card" style={{ borderColor: 'var(--c-moss)40', background: 'var(--c-moss)08', position: 'sticky', top: 40 }}>
          <div className="aside-card-eyebrow" style={{ color: 'var(--c-moss)' }}>Почему это работает</div>
          <h3>Мозг учится замечать</h3>
          <p className="body">Психика устроена так, чтобы запоминать опасное. Регулярная практика благодарности — это не «позитивное мышление», а тренировка нервной системы замечать тёплое наряду с тревожным.</p>
        </div>
      }
    >
      <div style={{ marginTop: 8 }}>
        {items.map((item, i) => (
          <div key={i} className={'grat-row ' + (item.trim() ? 'is-filled' : '')}>
            <span className="grat-num-big">{String(i + 1).padStart(2, '0')}</span>
            <textarea
              value={item}
              onChange={e => update(i, e.target.value)}
              placeholder={PLACEHOLDERS[i] ?? PLACEHOLDERS[PLACEHOLDERS.length - 1]}
              rows={1}
              autoFocus={i === 0}
            />
          </div>
        ))}
        {items.length < 5 && (
          <button className="add-row-btn" onClick={addItem}>
            <GlyphPlus />
            <span style={{ marginLeft: 8 }}>Добавить ещё пункт</span>
          </button>
        )}
      </div>

      <div className="ex-foot">
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {filled.length} / {items.length} заполнено
        </span>
        <span className="spacer" />
        <button
          className="ex-btn ex-btn-primary"
          disabled={!canSave || saving}
          onClick={handleSave}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {saving ? 'Сохраняю…' : 'Сохранить запись'}
          {!saving && <GlyphCheck />}
        </button>
      </div>
    </ExScreen>
  );
}
