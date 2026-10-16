import { useState, useEffect, useRef } from 'react';
import { ExScreen, GlyphPlus } from '../exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { saveDraft, loadDraft, clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { fmtDateLong, todayStr } from '../../utils/format';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import { DiaryAside } from './DiaryStepCard';
import { haptic } from '../../haptic';
import { SaveEntryButton } from './SaveEntryButton';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../shared/src/limits/textLimits';

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
  'Что-то, что обычно ускользает…',
];

export function GratitudeEntrySheet({ onClose, date, existingItems, onSave }: Props) {
  const goBack = useHistorySheet(onClose);
  const existing = !existingItems ? loadDraft<{ items: string[] }>('gratitude') : null;
  const initItems = existingItems ?? existing?.data?.items ?? ['', '', ''];

  const [items, setItems] = useState<string[]>(initItems);
  const [saving, setSaving] = useState(false);
  // Отказ сохранения раньше сообщался ТОЛЬКО вибрацией haptic.error(), а лист
  // всё равно закрывался: на десктопе вибрации нет вовсе, и человек считал,
  // что запись сохранена. Текст уцелел бы черновиком, но об этом тоже никто
  // не сообщал.
  const [saveError, setSaveError] = useState(false);
  const firstItemRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { firstItemRef.current?.focus(); }, []);

  const update = (i: number, v: string) => setItems(prev => prev.map((it, idx) => idx === i ? v : it));
  const addItem = () => { haptic.select(); setItems(prev => prev.length < 5 ? [...prev, ''] : prev); };

  useEffect(() => {
    if (!existingItems) saveDraft('gratitude', { items });
  }, [items, existingItems]);

  const filled = items.filter(it => it.trim().length > 0);
  const canSave = filled.length >= 1;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaveError(false);
    haptic.success();
    setSaving(true);
    try {
      await onSave(date, filled);
      clearDraft('gratitude');
      goBack();
    } catch {
      haptic.error();
      setSaveError(true); // лист НЕ закрываем — иначе отказ неотличим от успеха
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = date === todayStr() ? 'сегодня' : fmtDateLong(date);

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад к дневнику"
      eyebrow={`Дневник благодарности · ${dateLabel}`}
      title={<>Три вещи,<br /><span className="it">за которые сегодня – спасибо</span></>}
      lede="Даже самое маленькое. Особенно самое маленькое. Запоминается то, что удалось назвать. Хватит и одной строки."
      aside={
        <DiaryAside hue={DIARY_HUE.gratitude} eyebrow="Почему это работает" title="Мозг учится замечать">
          <p className="ds-sub">Психика устроена так, чтобы запоминать опасное. Регулярная практика благодарности – не «позитивное мышление», а тренировка нервной системы замечать тёплое наряду с тревожным.</p>
        </DiaryAside>
      }
    >
      <div className="sd-grat" style={hueStyle(DIARY_HUE.gratitude)}>
        {items.map((item, i) => (
          <div key={i} className={'ds-card ds-card--row sd-grat-row' + (item.trim() ? ' is-filled' : '')}>
            <span className="ds-num sd-grat-num">{String(i + 1).padStart(2, '0')}</span>
            <div className="sd-grat-field">
              <LimitedTextarea max={DIARY_FIELD_MAX} ref={i === 0 ? firstItemRef : undefined} value={item} onChange={e => update(i, e.target.value)} rows={1} className="ds-textarea"
                placeholder={PLACEHOLDERS[i] ?? PLACEHOLDERS[PLACEHOLDERS.length - 1]}
                aria-label={`Пункт ${i + 1}: ${PLACEHOLDERS[i] ?? PLACEHOLDERS[PLACEHOLDERS.length - 1]}`} />
            </div>
          </div>
        ))}
        {detectCrisisAny(...items) && <CrisisCard surface="gratitude" />}
        {items.length < 5 && (
          <button className="ds-btn ds-btn--secondary ds-btn--sm" onClick={addItem}>
            <GlyphPlus />
            <span>Добавить ещё пункт</span>
          </button>
        )}
      </div>

      <div className="sd-foot">
        <span className="ds-sub">
          {filled.length} / {items.length} заполнено
        </span>
        <span className="sd-spacer" />
        <SaveEntryButton canSave={canSave} saving={saving} onSave={handleSave} />
        {saveError && (
          <div role="status" className="sd-save-error">
            Не удалось сохранить. Текст остался черновиком — можно повторить
          </div>
        )}
      </div>
    </ExScreen>
  );
}
