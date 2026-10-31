import { useState, useEffect, useRef } from 'react';
import { ExScreen, GlyphPlus } from '../exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { fmtDateLong, todayStr } from '../../utils/format';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import { DiaryAside } from './DiaryStepCard';
import { haptic } from '../../haptic';
import { SaveEntryButton } from './SaveEntryButton';
import { GratitudeLoadState } from './GratitudeLoadState';
import { PLACEHOLDERS } from './gratitudePlaceholders';
import { api } from '../../api';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../shared/src/limits/textLimits';
import { useGratitudeItems } from '../../../../shared/src/diary/useGratitudeItems';
import { useSeedGratitudeItem } from './quickEntry/useSeedGratitudeItem';

interface Props {
  initialItem?: string; // текст из «Дневника одной страницей»: встаёт в первый пустой пункт
  onClose: () => void;
  date: string;
  existingItems?: string[];
  onSave: (date: string, items: string[]) => Promise<void>;
}

export function GratitudeEntrySheet({ initialItem, onClose, date, existingItems, onSave }: Props) {
  const goBack = useHistorySheet(onClose);
  // Форма сама поднимает сохранённый день: сервер заменяет пункты дня целиком,
  // и вход без existingItems («плюс») иначе стирал бы прежнюю запись
  // (инцидент 2026-10-18, docs/INCIDENTS.md).
  const { items, setItems, status, retry } = useGratitudeItems({
    date,
    existingItems,
    load: () => api.getGratitudeDiary(),
  });
  const ready = status === 'ready';
  const [saving, setSaving] = useState(false);
  // Отказ раньше сообщался лишь вибрацией (в браузере её нет) и закрывал лист.
  const [saveError, setSaveError] = useState(false);
  const firstItemRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (ready) firstItemRef.current?.focus(); }, [ready]);
  useSeedGratitudeItem(ready, initialItem, setItems);

  const update = (i: number, v: string) => setItems(prev => prev.map((it, idx) => idx === i ? v : it));
  const addItem = () => { haptic.select(); setItems(prev => prev.length < 5 ? [...prev, ''] : prev); };

  const filled = items.filter(it => it.trim().length > 0);
  const canSave = ready && filled.length >= 1;

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
        <GratitudeLoadState status={status} onRetry={retry} />
        {ready && items.map((item, i) => (
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
        {ready && items.length < 5 && (
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
