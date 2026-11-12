import { useState, useEffect, useRef } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { clearDraft } from '../../utils/drafts';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { fmtDateLong, todayStr } from '../../utils/format';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { GratitudeAddRow, GratitudeLede, GratitudeSaveError, GratitudeTitle, GratitudeWhy } from './GratitudeParts';
import { GratitudePebbles } from './quickEntry/GratitudePebbles';
import { haptic } from '../../haptic';
import { SaveEntryButton } from './SaveEntryButton';
import { GratitudeLoadState } from './GratitudeLoadState';
import { PLACEHOLDERS } from './gratitudePlaceholders';
import { api } from '../../api';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../shared/src/limits/textLimits';
import { useGratitudeItems } from '../../../../shared/src/diary/useGratitudeItems';
import { useSeedGratitudeItem } from './quickEntry/useSeedGratitudeItem';
import { isUnwritableError } from '../../../../shared/src/api/unwritableError';

const HUE = ENTITY_LOOK.gratitude.hue; // бирюза (решение 1, APP_2026-11.md): лист-герой и тетрадь

interface Props {
  initialItem?: string; // текст из «Дневника одной страницей»: встаёт в первый пустой пункт
  onClose: () => void;
  date: string;
  existingItems?: string[];
  onSave: (date: string, items: string[], base: string[]) => Promise<void>;
}

// Лист-герой с камешками по заполненным пунктам (Pebbles filled), тетрадь — белый лист со строками
// 01–05 без рамок; на компьютере — разворот (b10a, docs/design/APP_2026-11.md).
export function GratitudeEntrySheet({ initialItem, onClose, date, existingItems, onSave }: Props) {
  const goBack = useHistorySheet(onClose);
  // Форма сама поднимает сохранённый день (инцидент 2026-10-18), а base — то,
  // с чего она начала: сервер сливает с ним сохранение и не теряет пункт,
  // добавленный с другой вкладки (src/bot/gratitude-merge.ts).
  const { items, setItems, base, status, retry } = useGratitudeItems({
    date,
    existingItems,
    load: () => api.getGratitudeDiary(),
  });
  const ready = status === 'ready';
  const [saving, setSaving] = useState(false);
  // Отказ раньше сообщался лишь вибрацией (в браузере её нет) и закрывал лист.
  // 409 «не читается» (E15): повтор не поможет — прежние пункты сервер бережёт.
  const [saveError, setSaveError] = useState<'failed' | 'unreadable' | null>(null);
  const firstItemRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (ready) firstItemRef.current?.focus(); }, [ready]);
  useSeedGratitudeItem(ready, initialItem, setItems);

  const update = (i: number, v: string) => setItems(prev => prev.map((it, idx) => idx === i ? v : it));
  const addItem = () => { haptic.select(); setItems(prev => prev.length < 5 ? [...prev, ''] : prev); };

  const filled = items.filter(it => it.trim().length > 0);
  const canSave = ready && filled.length >= 1;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaveError(null);
    haptic.success();
    setSaving(true);
    try {
      await onSave(date, filled, base);
      clearDraft('gratitude');
      goBack();
    } catch (e) {
      haptic.error();
      setSaveError(isUnwritableError(e) ? 'unreadable' : 'failed'); // лист НЕ закрываем — иначе отказ неотличим от успеха
    } finally {
      setSaving(false);
    }
  };

  const isToday = date === todayStr();
  const dateLabel = isToday ? 'сегодня' : fmtDateLong(date);
  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад к дневнику"
      look="gratitude"
      heroArt={<GratitudePebbles filled={filled.length} />}
      spread
      eyebrow={`Дневник благодарности · ${dateLabel}`}
      title={<GratitudeTitle today={isToday} />}
      lede={<GratitudeLede />}
      aside={<GratitudeWhy hue={HUE} />}
    >
      <div className="sd-grat" style={hueStyle(HUE)}>
        <GratitudeLoadState status={status} onRetry={retry} />
        {ready && (
          <div className="pa-field sd-grat-sheet">
            {items.map((item, i) => (
              <div key={i} className={'sd-grat-row' + (item.trim() ? ' is-filled' : '')}>
                <span className="sd-grat-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <div className="sd-grat-field">
                  <LimitedTextarea max={DIARY_FIELD_MAX} ref={i === 0 ? firstItemRef : undefined} value={item} onChange={e => update(i, e.target.value)} rows={1} className="ds-textarea"
                    placeholder={PLACEHOLDERS[i] ?? PLACEHOLDERS[PLACEHOLDERS.length - 1]}
                    aria-label={`Пункт ${i + 1}: ${PLACEHOLDERS[i] ?? PLACEHOLDERS[PLACEHOLDERS.length - 1]}`} />
                </div>
              </div>
            ))}
            {items.length < 5 && <GratitudeAddRow onAdd={addItem} />}
          </div>
        )}
        {detectCrisisAny(...items) && <CrisisCard surface="gratitude" />}
      </div>

      <div className="sd-foot">
        <span className="ds-sub">{filled.length} / {items.length} заполнено</span>
        <span className="sd-spacer" />
        <SaveEntryButton canSave={canSave} saving={saving} onSave={handleSave} />
      </div>
      {saveError && <GratitudeSaveError kind={saveError} />}
    </ExScreen>
  );
}
