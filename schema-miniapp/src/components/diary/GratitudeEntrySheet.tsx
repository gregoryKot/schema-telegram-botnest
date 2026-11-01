import { useState } from 'react';
import { BottomSheet } from '../BottomSheet';
import { api } from '../../api';
import { clearDraft } from '../../utils/drafts';
import { fmtDateLong, todayStr } from '../../utils/format';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { GratitudeItemsPanel, GratitudeLoadState } from './GratitudeParts';
import { PrimaryAction } from './diaryFlowUi';
import { useGratitudeItems } from '../../../../shared/src/diary/useGratitudeItems';

interface Props {
  onClose: () => void;
  date: string;
  existingItems?: string[];
  onSave: (date: string, items: string[], base: string[]) => Promise<void>;
}

export function GratitudeEntrySheet({
  onClose,
  date,
  existingItems,
  onSave,
}: Props) {
  const tr = useTr();
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
  // Отказ раньше сообщался лишь вибрацией, а лист закрывался: на десктопе
  // вибрации нет, и человек считал запись сохранённой.
  const [saveError, setSaveError] = useState(false);

  const update = (i: number, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? v : it)));

  const canSave =
    ready && items.filter((it) => it.trim().length > 0).length >= 1;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaveError(false);
    haptic.success();
    setSaving(true);
    try {
      await onSave(
        date,
        items.filter((it) => it.trim().length > 0),
        base,
      );
      clearDraft('gratitude');
      onClose();
    } catch {
      haptic.error();
      setSaveError(true); // лист НЕ закрываем — иначе отказ неотличим от успеха
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = date === todayStr() ? 'сегодня' : fmtDateLong(date);

  return (
    <BottomSheet onClose={onClose}>
      <div className="u-pt4">
        <div className="d-caps u-mb14">Дневник благодарности · {dateLabel}</div>
        <div className="d-display u-e21">
          За что есть благодарность сегодня?
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--muted)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Даже самое маленькое — оно считается. Хватит и одной строки.
        </div>

        <GratitudeLoadState status={status} onRetry={retry} />

        {/* Строки в одном контейнере, границу держит волосяная линия. */}
        {ready && <GratitudeItemsPanel items={items} onChange={update} />}

        {ready && items.length < 5 && (
          <button
            onClick={() => setItems((prev) => [...prev, ''])}
            style={{
              background: 'none',
              border: 'none',
              padding: '18px 2px',
              minHeight: 48,
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Добавить строку
          </button>
        )}

        <div className="u-mt12">
          <PrimaryAction
            label={saving ? 'Сохраняю…' : 'Сохранить'}
            hint={tr(
              'Напиши хотя бы одну строку — и запись сохранится',
              'Напишите хотя бы одну строку — и запись сохранится',
            )}
            disabled={!canSave || saving}
            onClick={handleSave}
          />
        </div>
        {saveError && (
          <div
            role="status"
            style={{
              marginTop: 10,
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--accent-red)',
            }}
          >
            Не удалось сохранить. Текст остался черновиком — можно повторить
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
